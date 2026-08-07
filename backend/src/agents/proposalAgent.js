/**
 * proposalAgent.js — Worker-side Proposal Agent orchestrator.
 *
 * Workflow:
 *  1. Load worker profile and skills
 *  2. Load open jobs (excluding already-proposed)
 *  3. Score each job for fit
 *  4. Build ranked recommendations
 *  5. Draft a proposal message for each top job
 *  6. Save run + steps + recommendations
 *  7. Return run id — wait for confirmation before submission
 */

const pool = require('../db');
const { scoreJobForWorker, draftProposalMessage } = require('./scoring');
const { getMemory, setMemory } = require('./memory');
const { getOpenJobsForWorker } = require('./tools/getOpenJobs');

const TOP_N = 5;

/**
 * Load full worker profile including skills.
 */
async function getWorkerProfile(workerId) {
  const userResult = await pool.query(
    `SELECT u.id, u.full_name, u.district, u.area, u.is_nic_verified,
            wp.id AS worker_profile_id,
            wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating
     FROM users u
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'worker'`,
    [workerId]
  );
  if (!userResult.rows[0]) return null;
  const worker = userResult.rows[0];

  const skillsResult = await pool.query(
    `SELECT ws.category_id, ws.is_primary, c.name AS category_name, c.icon AS category_icon
     FROM worker_skills ws
     JOIN categories c ON c.id = ws.category_id
     WHERE ws.worker_id = $1`,
    [worker.worker_profile_id]
  );
  worker.skills = skillsResult.rows;

  return worker;
}

/**
 * Run the proposal agent for a given worker.
 * @param {string} workerId
 * @returns {Object} the full agent run record with steps and recommendations
 */
async function runProposalAgent(workerId) {
  const steps = [];
  let runId;

  const runResult = await pool.query(
    `INSERT INTO agent_runs (user_id, agent_type, objective, status)
     VALUES ($1, 'proposal', $2, 'running') RETURNING id`,
    [workerId, `Find best jobs for worker ${workerId}`]
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
    // ── Step 1: Load worker profile ───────────────────────────────────────
    const worker = await getWorkerProfile(workerId);
    if (!worker) throw new Error('Worker profile not found');

    await logStep(1, 'load_worker_profile', { workerId }, {
      full_name:     worker.full_name,
      district:      worker.district,
      primary_skill: worker.primary_skill,
      skills_count:  worker.skills.length,
      avg_rating:    worker.avg_rating,
    });

    // ── Step 2: Load open jobs ────────────────────────────────────────────
    const prefDistrict = await getMemory(workerId, 'proposal_prefs', 'preferred_district');
    const searchDistrict = prefDistrict || worker.district || null;

    let jobs = await getOpenJobsForWorker(workerId, { limit: 100 });

    await logStep(2, 'load_open_jobs', { district: searchDistrict }, {
      jobs_found: jobs.length,
    });

    // ── Step 3 & 4: Score and rank ────────────────────────────────────────
    const scored = jobs.map(job => {
      const { total, factors, rationale } = scoreJobForWorker(job, worker);
      return { job, total, factors, rationale };
    });

    scored.sort((a, b) => b.total - a.total);
    const top = scored.slice(0, TOP_N);

    await logStep(3, 'score_and_rank', {
      total_jobs: jobs.length,
    }, {
      top_scores: top.map(t => ({ id: t.job.id, score: t.total })),
    }, `Ranked ${jobs.length} jobs, returning top ${TOP_N}`);

    // ── Step 5: Draft proposals and save recommendations ──────────────────
    const recommendations = [];
    for (let i = 0; i < top.length; i++) {
      const { job, total, factors, rationale } = top[i];
      const proposalDraft = draftProposalMessage(job, worker);

      const recResult = await pool.query(
        `INSERT INTO agent_recommendations
           (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
         VALUES ($1, 'job', $2, $3, $4, $5, $6)
         RETURNING id`,
        [runId, job.id, total, JSON.stringify(factors), rationale, i + 1]
      );

      recommendations.push({
        recommendation_id: recResult.rows[0].id,
        rank: i + 1,
        score: total,
        factors,
        rationale,
        proposal_draft: proposalDraft,
        job: {
          id:             job.id,
          title:          job.title,
          district:       job.district,
          urgency:        job.urgency,
          pricing_mode:   job.pricing_mode,
          fixed_budget:   job.fixed_budget,
          category_name:  job.category_name,
          category_icon:  job.category_icon,
          proposal_count: job.proposal_count,
          created_at:     job.created_at,
        },
      });
    }

    await logStep(4, 'draft_proposals', {}, {
      proposals_drafted: recommendations.length,
    });

    // ── Step 6: Update memory ─────────────────────────────────────────────
    if (worker.district) {
      await setMemory(workerId, 'proposal_prefs', 'preferred_district', worker.district);
    }

    const plan = [
      'Load worker profile and skills',
      'Fetch open jobs',
      'Score and rank jobs',
      'Draft proposal messages',
      'Await worker confirmation',
      'Submit proposals for confirmed jobs',
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
      worker: {
        id:            worker.id,
        full_name:     worker.full_name,
        primary_skill: worker.primary_skill,
        district:      worker.district,
      },
      recommendations,
    };

  } catch (err) {
    await pool.query(`UPDATE agent_runs SET status = 'error' WHERE id = $1`, [runId]);
    await logStep(99, 'error', {}, { error: err.message });
    throw err;
  }
}

/**
 * Confirm the proposal agent run — submit proposals to selected jobs.
 * @param {string} runId
 * @param {string} workerId
 * @param {Array} selections — [{ job_id, message, proposed_price, inspection_needed, availability }]
 */
async function confirmProposalAgent(runId, workerId, selections) {
  const { submitProposal } = require('./tools/submitProposal');

  const runResult = await pool.query(
    `SELECT * FROM agent_runs WHERE id = $1 AND user_id = $2 AND agent_type = 'proposal'`,
    [runId, workerId]
  );
  const run = runResult.rows[0];
  if (!run) throw new Error('Agent run not found');
  if (run.status !== 'awaiting_confirmation') throw new Error('Run is not awaiting confirmation');

  const results = [];
  for (const sel of selections) {
    const { job_id, message, proposed_price, inspection_needed, availability } = sel;
    try {
      const { proposal, alreadyExists } = await submitProposal(job_id, workerId, {
        message,
        proposed_price: proposed_price || null,
        inspection_needed: inspection_needed || false,
        availability: availability || '',
      });

      await pool.query(
        `UPDATE agent_recommendations
         SET action_taken = 'proposal_submitted', action_at = NOW()
         WHERE run_id = $1 AND entity_type = 'job' AND entity_id = $2`,
        [runId, job_id]
      );

      results.push({ job_id, status: alreadyExists ? 'already_proposed' : 'submitted', proposalId: proposal.id });
    } catch (err) {
      results.push({ job_id, status: 'error', error: err.message });
    }
  }

  await pool.query(
    `UPDATE agent_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [runId]
  );

  await pool.query(
    `INSERT INTO agent_run_steps (run_id, step_index, step_name, input_json, output_json, decision)
     VALUES ($1, 10, 'confirm_proposals', $2, $3, $4)`,
    [runId,
     JSON.stringify({ jobs_selected: selections.map(s => s.job_id) }),
     JSON.stringify({ results }),
     `Submitted ${results.filter(r => r.status === 'submitted').length} proposals`]
  );

  return { run_id: runId, status: 'completed', results };
}

module.exports = { runProposalAgent, confirmProposalAgent };
