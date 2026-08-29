/**
 * proposalAgent.js — Worker-side Proposal Agent (Gemini-powered with deterministic fallback).
 */

const pool = require('../db');
const { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured } = require('./gemini');
const { getOpenJobsForWorker } = require('./tools/getOpenJobs');
const { scoreJobForWorker, draftProposalMessage } = require('./scoring');
const { getMemory } = require('./memory');

const TOP_N = 5;

const PROPOSAL_TOOLS = [
  {
    name: 'get_worker_profile',
    description: 'Fetch worker profile and skills.',
    parameters: {
      type: 'object',
      properties: { worker_id: { type: 'string' } },
      required: ['worker_id'],
    },
  },
  {
    name: 'recall_worker_memory',
    description: 'Retrieve worker preferences.',
    parameters: {
      type: 'object',
      properties: { scope: { type: 'string' } },
      required: ['scope'],
    },
  },
  {
    name: 'get_open_jobs',
    description: 'Fetch open jobs available for proposal.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'score_job_for_worker',
    description: 'Calculate compatibility score between worker and job.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        worker_id: { type: 'string' },
      },
      required: ['job_id', 'worker_id'],
    },
  },
  {
    name: 'draft_proposal_message',
    description: 'Generate personalised proposal message.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        worker_id: { type: 'string' },
        worker_name: { type: 'string' },
        worker_skill: { type: 'string' },
        job_title: { type: 'string' },
      },
      required: ['job_id', 'worker_id', 'job_title', 'worker_name', 'worker_skill'],
    },
  },
];

const SYSTEM_PROMPT = `You are an intelligent Proposal Agent for Fixly in Sri Lanka.
Goal: Help a worker find top jobs and write proposals.

Process:
1. get_worker_profile
2. recall_worker_memory (scope: "proposal_prefs")
3. get_open_jobs
4. score_job_for_worker
5. draft_proposal_message
6. Output final JSON

Output Format (ONLY valid JSON):
{
  "overall_reasoning": "Brief explanation of your job selection strategy",
  "recommendations": [
    {
      "job_id": "<uuid>",
      "rank": 1,
      "score": 0.88,
      "ai_rationale": "Reason this job fits the worker",
      "key_strengths": ["skill match", "low competition"],
      "proposal_draft": "Personalised proposal message"
    }
  ]
}`;

async function getWorkerProfile(workerId) {
  const r = await pool.query(
    `SELECT u.id, u.full_name, u.district, u.area, u.is_nic_verified,
            wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating
     FROM users u
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'worker'`,
    [workerId]
  );
  if (!r.rows[0]) return null;
  const worker = r.rows[0];

  const skills = await pool.query(
    `SELECT ws.category_id, ws.is_primary, c.name AS category_name
     FROM worker_skills ws
     JOIN categories c ON c.id = ws.category_id
     WHERE ws.worker_id = (SELECT id FROM worker_profiles WHERE user_id = $1)`,
    [workerId]
  );
  worker.skills = skills.rows;
  return worker;
}

function buildToolHandlers({ workerId, workerCache, jobCache }) {
  return {
    async get_worker_profile({ worker_id }) {
      const worker = await getWorkerProfile(worker_id || workerId);
      if (!worker) return { error: 'Worker not found' };
      workerCache.current = worker;
      return worker;
    },

    async recall_worker_memory({ scope }) {
      const prefDistrict = await getMemory(workerId, scope, 'preferred_district');
      return { preferred_district: prefDistrict };
    },

    async get_open_jobs({ district: _district, limit = 60 }) {
      const jobs = await getOpenJobsForWorker(workerId, { limit });
      for (const j of jobs) jobCache[j.id] = j;
      return { count: jobs.length, jobs };
    },

    async score_job_for_worker({ job_id, worker_id }) {
      const job = jobCache[job_id];
      const worker = workerCache.current || await getWorkerProfile(worker_id || workerId);
      if (!job || !worker) return { error: 'Job or worker not found' };
      const { total, factors } = scoreJobForWorker(job, worker);
      return { job_id, score: total, factors };
    },

    async draft_proposal_message(_args) {
      return { status: 'ok' };
    },
  };
}

// ── Deterministic Fallback Proposal Logic ──────────────────────────────────
async function runDeterministicProposal(worker, runId, logStep) {
  const jobs = await getOpenJobsForWorker(worker.id, { limit: 100 });
  await logStep(1, 'load_open_jobs', {}, { count: jobs.length });

  const scored = jobs.map(job => {
    const { total, factors, rationale } = scoreJobForWorker(job, worker);
    return { job, total, factors, rationale };
  });

  scored.sort((a, b) => b.total - a.total);
  const top = scored.slice(0, TOP_N);

  const recommendations = [];
  for (let i = 0; i < top.length; i++) {
    const { job, total, factors, rationale } = top[i];
    const proposalDraft = draftProposalMessage(job, worker);

    const recResult = await pool.query(
      `INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
       VALUES ($1, 'job', $2, $3, $4, $5, $6) RETURNING id`,
      [runId, job.id, total, JSON.stringify(factors), rationale, i + 1]
    );

    recommendations.push({
      recommendation_id: recResult.rows[0].id,
      rank: i + 1,
      score: total,
      factors,
      rationale,
      key_strengths: [job.category_name || 'Category match', job.district || 'Location match'],
      proposal_draft: proposalDraft,
      job: {
        id: job.id,
        title: job.title,
        district: job.district,
        urgency: job.urgency,
        pricing_mode: job.pricing_mode,
        fixed_budget: job.fixed_budget,
        category_name: job.category_name,
        proposal_count: job.proposal_count,
        created_at: job.created_at,
      },
    });
  }

  const overallReasoning = isGeminiKeyConfigured()
    ? `Ranked top ${recommendations.length} job matches for ${worker.full_name}.`
    : `Ranked top ${recommendations.length} job matches for ${worker.full_name} using Fixly Proposal Engine (Add a valid GEMINI_API_KEY to backend/.env for Gemini 1.5 Flash live reasoning).`;

  const plan = [
    'Load worker profile & skills',
    'Fetch open jobs',
    'Score job compatibility',
    'Draft proposal messages',
    'Await worker confirmation',
    'Submit proposals',
  ];

  await pool.query(
    `UPDATE agent_runs SET status = 'awaiting_confirmation', plan_json = $1 WHERE id = $2`,
    [JSON.stringify(plan), runId]
  );

  return {
    run_id: runId,
    status: 'awaiting_confirmation',
    plan,
    steps: [{ stepIndex: 1, stepName: 'proposal_scoring', decision: 'Proposal scoring complete' }],
    overall_reasoning: overallReasoning,
    worker: { id: worker.id, full_name: worker.full_name, primary_skill: worker.primary_skill },
    recommendations,
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────
async function runProposalAgent(workerId) {
  const runResult = await pool.query(
    `INSERT INTO agent_runs (user_id, agent_type, objective, status)
     VALUES ($1, 'proposal', $2, 'running') RETURNING id`,
    [workerId, `Find best job opportunities for worker ${workerId}`]
  );
  const runId = runResult.rows[0].id;

  const loggedSteps = [];
  async function logStep(stepIndex, stepName, input, output, decision = null) {
    await pool.query(
      `INSERT INTO agent_run_steps (run_id, step_index, step_name, input_json, output_json, decision)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runId, stepIndex, stepName, JSON.stringify(input), JSON.stringify(output), decision]
    );
    loggedSteps.push({ stepIndex, stepName, decision });
  }

  try {
    const worker = await getWorkerProfile(workerId);
    if (!worker) throw new Error('Worker profile not found');

    if (isGeminiKeyConfigured()) {
      try {
        const workerCache = { current: worker };
        const jobCache = {};
        let stepIndex = 1;

        const { text: geminiText } = await runGeminiAgent({
          systemInstruction: SYSTEM_PROMPT,
          userPrompt: `Find top jobs for worker ID ${workerId}`,
          tools: PROPOSAL_TOOLS,
          toolHandlers: buildToolHandlers({ workerId, workerCache, jobCache }),
          onStep: async (step) => {
            await logStep(stepIndex++, step.stepName, step.input, step.output, null);
          },
        });

        const parsed = parseJsonFromText(geminiText);
        const geminiRecs = parsed.recommendations || [];

        if (geminiRecs.length > 0) {
          const recommendations = [];
          for (let i = 0; i < geminiRecs.length; i++) {
            const rec = geminiRecs[i];
            const job = jobCache[rec.job_id];
            if (!job) continue;

            const { factors } = scoreJobForWorker(job, worker);
            const recResult = await pool.query(
              `INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
               VALUES ($1, 'job', $2, $3, $4, $5, $6) RETURNING id`,
              [runId, job.id, rec.score, JSON.stringify(factors), rec.ai_rationale, rec.rank || i + 1]
            );

            recommendations.push({
              recommendation_id: recResult.rows[0].id,
              rank: rec.rank || i + 1,
              score: rec.score,
              factors,
              rationale: rec.ai_rationale,
              key_strengths: rec.key_strengths || [],
              proposal_draft: rec.proposal_draft || draftProposalMessage(job, worker),
              job,
            });
          }

          const plan = [
            'Load worker profile',
            'Fetch open jobs',
            'AI ranking and reasoning',
            'Draft proposals',
            'Await confirmation',
            'Submit proposals',
          ];

          await pool.query(
            `UPDATE agent_runs SET status = 'awaiting_confirmation', plan_json = $1 WHERE id = $2`,
            [JSON.stringify(plan), runId]
          );

          return {
            run_id: runId,
            status: 'awaiting_confirmation',
            plan,
            steps: loggedSteps,
            overall_reasoning: parsed.overall_reasoning,
            worker: { id: worker.id, full_name: worker.full_name, primary_skill: worker.primary_skill },
            recommendations,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to deterministic scoring:', geminiErr.message);
      }
    }

    // Fallback to deterministic proposal engine
    return await runDeterministicProposal(worker, runId, logStep);

  } catch (err) {
    await pool.query(`UPDATE agent_runs SET status = 'error' WHERE id = $1`, [runId]);
    throw err;
  }
}

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
        `UPDATE agent_recommendations SET action_taken = 'proposal_submitted', action_at = NOW()
         WHERE run_id = $1 AND entity_type = 'job' AND entity_id = $2`,
        [runId, job_id]
      );
      results.push({ job_id, status: alreadyExists ? 'already_proposed' : 'submitted', proposalId: proposal.id });
    } catch (err) {
      results.push({ job_id, status: 'error', error: err.message });
    }
  }

  await pool.query(`UPDATE agent_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [runId]);
  return { run_id: runId, status: 'completed', results };
}

module.exports = { runProposalAgent, confirmProposalAgent };
