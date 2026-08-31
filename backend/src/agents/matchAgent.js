/**
 * matchAgent.js — Customer-side Job Match Agent (Gemini-powered with deterministic fallback).
 */

const pool = require('../db');
const { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured } = require('./gemini');
const { getJobDetails } = require('./tools/getJobDetails');
const { getCandidateWorkers } = require('./tools/getCandidateWorkers');
const { scoreWorkerForJob } = require('./scoring');
const { getMemory } = require('./memory');

const TOP_N = 5;

const MATCH_TOOLS = [
  {
    name: 'get_job_details',
    description: 'Fetch full details about a job: title, description, category, location (district), budget, urgency level, and pricing mode. Always call this first.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'UUID of the job to look up' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_candidate_workers',
    description: 'Fetch a list of available workers. Optionally filter by district. Returns worker profiles including skills, rating, completed jobs count, and starting price.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Filter workers by district (optional)' },
        limit: { type: 'number', description: 'Max number of workers to return' },
      },
    },
  },
  {
    name: 'score_worker_for_job',
    description: 'Calculate an objective compatibility score (0–1) between a specific worker and this job.',
    parameters: {
      type: 'object',
      properties: {
        worker_id: { type: 'string', description: 'ID of the worker to score' },
        job_id: { type: 'string', description: 'ID of the job' },
      },
      required: ['worker_id', 'job_id'],
    },
  },
  {
    name: 'recall_customer_memory',
    description: 'Retrieve stored preferences for this customer.',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Memory scope key, e.g. "match_prefs"' },
      },
      required: ['scope'],
    },
  },
];

const SYSTEM_PROMPT = `You are an intelligent Job Matching Agent for Fixly marketplace in Sri Lanka.
Goal: Analyse a job and find the best workers to invite.

Process:
1. Call get_job_details
2. Recall customer preferences with recall_customer_memory (scope: "match_prefs")
3. Call get_candidate_workers (start with job's district, then widen if < 5)
4. Score top candidates with score_worker_for_job
5. Reason and rank best workers

Output Format (ONLY valid JSON):
{
  "overall_reasoning": "Brief explanation of your matching strategy",
  "recommendations": [
    {
      "worker_id": "<uuid>",
      "rank": 1,
      "score": 0.92,
      "ai_rationale": "Specific reason this worker is a great fit",
      "key_strengths": ["primary skill match", "same district"]
    }
  ]
}`;

function buildToolHandlers({ jobId, customerId, workerCache, jobCache }) {
  return {
    async get_job_details({ job_id }) {
      const job = await getJobDetails(job_id || jobId);
      if (!job) return { error: 'Job not found' };
      jobCache.current = job;
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        category_name: job.category_name,
        category_id: job.category_id,
        district: job.district,
        urgency: job.urgency,
        pricing_mode: job.pricing_mode,
        fixed_budget: job.fixed_budget,
      };
    },

    async get_candidate_workers({ district, limit = 80 }) {
      const workers = await getCandidateWorkers({ district: district || null, limit });
      for (const w of workers) workerCache[w.id] = w;
      return {
        count: workers.length,
        workers: workers.map(w => ({
          id: w.id,
          full_name: w.full_name,
          district: w.district,
          primary_skill: w.primary_skill,
          avg_rating: w.avg_rating,
          total_jobs_done: w.total_jobs_done,
          starting_price: w.starting_price,
          is_nic_verified: w.is_nic_verified,
        })),
      };
    },

    async score_worker_for_job({ worker_id, job_id }) {
      const worker = workerCache[worker_id];
      const job = jobCache.current || await getJobDetails(job_id || jobId);
      if (!worker || !job) return { error: 'Worker or job not found' };
      const { total, factors } = scoreWorkerForJob(worker, job);
      return { worker_id, score: total, factors };
    },

    async recall_customer_memory({ scope }) {
      const prefDistrict = await getMemory(customerId, scope, 'preferred_district');
      return { preferred_district: prefDistrict };
    },
  };
}

// ── Deterministic Fallback Match Logic ──────────────────────────────────────
async function runDeterministicMatch(job, customerId, runId, logStep) {
  const prefDistrict = await getMemory(customerId, 'match_prefs', 'preferred_district');
  const searchDistrict = prefDistrict || job.district || null;

  const candidates = await getCandidateWorkers({ district: searchDistrict, limit: 100 });
  const allCandidates = candidates.length >= 5 ? candidates : await getCandidateWorkers({ limit: 100 });

  await logStep(1, 'load_candidates', { district: searchDistrict }, { count: allCandidates.length });

  const scored = allCandidates.map(worker => {
    const { total, factors, rationale } = scoreWorkerForJob(worker, job);
    return { worker, total, factors, rationale };
  });

  scored.sort((a, b) => b.total - a.total);
  const top = scored.slice(0, TOP_N);

  const recommendations = [];
  for (let i = 0; i < top.length; i++) {
    const { worker, total, factors, rationale } = top[i];
    const recResult = await pool.query(
      `INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
       VALUES ($1, 'worker', $2, $3, $4, $5, $6) RETURNING id`,
      [runId, worker.id, total, JSON.stringify(factors), rationale, i + 1]
    );

    recommendations.push({
      recommendation_id: recResult.rows[0].id,
      rank: i + 1,
      score: total,
      factors,
      rationale,
      key_strengths: [worker.primary_skill || 'Skilled worker', worker.district || 'Local area'],
      worker,
    });
  }

  const overallReasoning = isGeminiKeyConfigured()
    ? 'Ranked candidate workers using Fixly Match Engine.'
    : 'Ranked candidate workers using Fixly Match Engine (Add a valid GEMINI_API_KEY to backend/.env for Gemini 1.5 Flash live reasoning).';

  const plan = [
    'Load job details',
    'Fetch candidate workers',
    'Score & rank workers',
    'Await customer confirmation',
    'Send invites to selected workers',
  ];

  await pool.query(
    `UPDATE agent_runs SET status = 'awaiting_confirmation', plan_json = $1 WHERE id = $2`,
    [JSON.stringify(plan), runId]
  );

  return {
    run_id: runId,
    status: 'awaiting_confirmation',
    plan,
    steps: [{ stepIndex: 1, stepName: 'match_scoring', decision: 'Deterministic scoring complete' }],
    overall_reasoning: overallReasoning,
    job: { id: job.id, title: job.title, category: job.category_name },
    recommendations,
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────
async function runMatchAgent(jobId, customerId) {
  const runResult = await pool.query(
    `INSERT INTO agent_runs (user_id, agent_type, objective, status, job_id)
     VALUES ($1, 'match', $2, 'running', $3) RETURNING id`,
    [customerId, `Find best workers for job ${jobId}`, jobId]
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
    const job = await getJobDetails(jobId);
    if (!job) throw new Error('Job not found');
    if (job.customer_id !== customerId) throw new Error('Not your job');

    // Try Gemini if configured
    if (isGeminiKeyConfigured()) {
      try {
        const workerCache = {};
        const jobCache = { current: job };
        let stepIndex = 1;

        const { text: geminiText } = await runGeminiAgent({
          systemInstruction: SYSTEM_PROMPT,
          userPrompt: `Match workers for job ID ${jobId}. Customer ID: ${customerId}`,
          tools: MATCH_TOOLS,
          toolHandlers: buildToolHandlers({ jobId, customerId, workerCache, jobCache }),
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
            const worker = workerCache[rec.worker_id];
            if (!worker) continue;

            const { factors } = scoreWorkerForJob(worker, job);
            const recResult = await pool.query(
              `INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, factors_json, rationale, rank)
               VALUES ($1, 'worker', $2, $3, $4, $5, $6) RETURNING id`,
              [runId, worker.id, rec.score, JSON.stringify(factors), rec.ai_rationale, rec.rank || i + 1]
            );

            recommendations.push({
              recommendation_id: recResult.rows[0].id,
              rank: rec.rank || i + 1,
              score: rec.score,
              factors,
              rationale: rec.ai_rationale,
              key_strengths: rec.key_strengths || [],
              worker,
            });
          }

          const plan = [
            'Load job details',
            'Recall preferences',
            'Fetch candidates',
            'AI reasoning & ranking',
            'Await customer confirmation',
            'Send invites',
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
            job: { id: job.id, title: job.title, category: job.category_name },
            recommendations,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to deterministic scoring:', geminiErr.message);
      }
    }

    // Fallback to deterministic matching engine if Gemini key is missing/invalid or call failed
    return await runDeterministicMatch(job, customerId, runId, logStep);

  } catch (err) {
    await pool.query(`UPDATE agent_runs SET status = 'error' WHERE id = $1`, [runId]);
    throw err;
  }
}

async function confirmMatchAgent(runId, customerId, selectedWorkerIds) {
  const { confirmMatchAgent: confirm } = require('../modules/marketplace/service');
  return confirm({ runId, customerId, selections: selectedWorkerIds });
}

module.exports = { runMatchAgent, confirmMatchAgent };
