/**
 * matchAgent.js — Customer-side Job Match Agent orchestrator.
 *
 * Workflow:
 *  1. Load job context
 *  2. Load candidate workers (with skills)
 *  3. Score all candidates
 *  4. Build ranked results
 *  5. Generate explanation for each score
 *  6. Save run + steps + recommendations
 *  7. Return run id — wait for confirmation before invites
 */

const pool = require('../db');
const { scoreWorkerForJob } = require('./scoring');
const { getMemory, setMemory } = require('./memory');
const { getJobDetails } = require('./tools/getJobDetails');
const { getCandidateWorkers } = require('./tools/getCandidateWorkers');

const TOP_N = 5; // max recommendations to return

/**
 * Run the match agent for a given job.
 * @param {string} jobId
 * @param {string} customerId — the authenticated customer
 * @returns {Object} the full agent run record with steps and recommendations
 */
async function runMatchAgent(jobId, customerId) {
  const steps = [];
  let runId;

  // ── Create run record ─────────────────────────────────────────────────────
  const runResult = await pool.query(
    `INSERT INTO agent_runs (user_id, agent_type, objective, status, job_id)
     VALUES ($1, 'match', $2, 'running', $3) RETURNING id`,
    [customerId, `Find best workers for job ${jobId}`, jobId]
  );
  runId = runResult.rows[0].id;

  async function logStep(stepIndex, stepName, input, output, decision = null) {
    await pool.query(
      `INSERT INTO agent_run_steps (run_id, step_index, step_name, input_json, output_json, decision)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runId, stepIndex, stepName, JSON.stringify(input), JSON.stringify(output), decision]
    );
    steps.push({ stepIndex, stepName, decision });
  }

  try {
    // ── Step 1: Load job ──────────────────────────────────────────────────
    const job = await getJobDetails(jobId);
    if (!job) throw new Error('Job not found');
    if (job.customer_id !== customerId) throw new Error('Not your job');

    await logStep(1, 'load_job', { jobId }, {
      title: job.title,
      category: job.category_name,
      district: job.district,
      urgency: job.urgency,
      budget: job.fixed_budget,
    });

    // ── Step 2: Load candidate workers ────────────────────────────────────
    // Check memory for preferred district filter
    const prefDistrict = await getMemory(customerId, 'match_prefs', 'preferred_district');
    const searchDistrict = prefDistrict || job.district || null;

    const candidates = await getCandidateWorkers({
      district: searchDistrict,
      limit: 100,
    });

    // If district-filtered returned < 5, widen search
    const allCandidates = candidates.length >= 5
      ? candidates
      : await getCandidateWorkers({ limit: 100 });

    await logStep(2, 'load_candidates', { district: searchDistrict }, {
      count: allCandidates.length,
      widened: candidates.length < 5,
    });

    // ── Step 3 & 4: Score and rank ────────────────────────────────────────
    const scored = allCandidates.map(worker => {
      const { total, factors, rationale } = scoreWorkerForJob(worker, job);
      return { worker, total, factors, rationale };
    });

    scored.sort((a, b) => b.total - a.total);
    const top = scored.slice(0, TOP_N);

    await logStep(3, 'score_and_rank', {
      total_candidates: allCandidates.length,
    }, {
      top_scores: top.map(t => ({ id: t.worker.id, score: t.total })),
    }, `Ranked ${allCandidates.length} workers, returning top ${TOP_N}`);

    // ── Step 5: Save recommendations ──────────────────────────────────────
    const recommendations = [];
    for (let i = 0; i < top.length; i++) {
      const { worker, total, factors, rationale } = top[i];
      const recResult = await pool.query(
        `INSERT INTO agent_recommendations
           (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
         VALUES ($1, 'worker', $2, $3, $4, $5, $6)
         RETURNING id`,
        [runId, worker.id, total, JSON.stringify(factors), rationale, i + 1]
      );

      recommendations.push({
        recommendation_id: recResult.rows[0].id,
        rank: i + 1,
        score: total,
        factors,
        rationale,
        worker: {
          id:              worker.id,
          full_name:       worker.full_name,
          district:        worker.district,
          profile_photo:   worker.profile_photo,
          is_nic_verified: worker.is_nic_verified,
          primary_skill:   worker.primary_skill,
          avg_rating:      worker.avg_rating,
          total_jobs_done: worker.total_jobs_done,
          starting_price:  worker.starting_price,
          skills:          worker.skills,
        },
      });
    }

    await logStep(4, 'save_recommendations', {}, {
      recommendations_saved: recommendations.length,
    });

    // ── Step 6: Update preferences memory ────────────────────────────────
    if (job.district) {
      await setMemory(customerId, 'match_prefs', 'preferred_district', job.district);
    }

    // ── Step 7: Set status → awaiting_confirmation ────────────────────────
    const plan = [
      'Load job details',
      'Fetch candidate workers',
      'Score and rank workers',
      'Generate explanations',
      'Await customer confirmation',
      'Send invites to confirmed workers',
    ];

    await pool.query(
      `UPDATE agent_runs
       SET status = 'awaiting_confirmation', plan_json = $1
       WHERE id = $2`,
      [JSON.stringify(plan), runId]
    );

    return {
      run_id: runId,
      status: 'awaiting_confirmation',
      plan,
      steps,
      job: { id: job.id, title: job.title, category: job.category_name },
      recommendations,
    };

  } catch (err) {
    // Mark run as error
    await pool.query(
      `UPDATE agent_runs SET status = 'error' WHERE id = $1`,
      [runId]
    );
    await logStep(99, 'error', {}, { error: err.message });
    throw err;
  }
}

/**
 * Confirm the match agent run — send invites to selected worker ids.
 * @param {string} runId
 * @param {string} customerId
 * @param {string[]} selectedWorkerIds — worker user ids to invite
 */
async function confirmMatchAgent(runId, customerId, selectedWorkerIds) {
  const { createInvite } = require('./tools/createInvite');

  // Verify ownership
  const runResult = await pool.query(
    `SELECT * FROM agent_runs WHERE id = $1 AND user_id = $2 AND agent_type = 'match'`,
    [runId, customerId]
  );
  const run = runResult.rows[0];
  if (!run) throw new Error('Agent run not found');
  if (run.status !== 'awaiting_confirmation') throw new Error('Run is not awaiting confirmation');

  const results = [];
  for (const workerId of selectedWorkerIds) {
    try {
      const { invite, alreadyExists } = await createInvite(run.job_id, customerId, workerId);

      // Update recommendation action
      await pool.query(
        `UPDATE agent_recommendations
         SET action_taken = 'invited', action_at = NOW()
         WHERE run_id = $1 AND entity_type = 'worker' AND entity_id = $2`,
        [runId, workerId]
      );

      results.push({ workerId, status: alreadyExists ? 'already_invited' : 'invited', inviteId: invite.id });
    } catch (err) {
      results.push({ workerId, status: 'error', error: err.message });
    }
  }

  await pool.query(
    `UPDATE agent_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [runId]
  );

  await pool.query(
    `INSERT INTO agent_run_steps (run_id, step_index, step_name, input_json, output_json, decision)
     VALUES ($1, 10, 'confirm_invites', $2, $3, $4)`,
    [runId, JSON.stringify({ selected: selectedWorkerIds }), JSON.stringify({ results }), `Sent ${results.filter(r => r.status === 'invited').length} invites`]
  );

  return { run_id: runId, status: 'completed', results };
}

module.exports = { runMatchAgent, confirmMatchAgent };
