/**
 * proposalAgent.js — Worker-side Proposal Agent (Gemini-powered).
 *
 * Matches matchAgent.js's design: the formula is an input signal, not a
 * gate or a silent substitute. When the Gemini call/validation chain
 * itself fails, the run degrades to an honestly-labeled, formula-sorted
 * list (buildDegradedProposalFallback) rather than going dark.
 */

const repository = require('../modules/agents/repository');
const { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured } = require('./gemini');
const { getOpenJobsForWorker } = require('./tools/getOpenJobs');
const { getWorkerReviews, REVIEW_LIMIT, UNTRUSTED_TEXT_NOTE, PROMPT_SAFETY_NOTE } = require('./tools/getWorkerReviews');
const { scoreJobForWorker, draftProposalMessage } = require('./scoring');
const { redactText, containsNonLatinScript } = require('./redact');
const { getMemory } = require('./memory');
const { proposalAgentOutputSchema, filterHallucinationRedFlags } = require('./schemas');

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
    description: 'Fetch open jobs available for proposal, including each job\'s full free-text description.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_my_reviews',
    description: 'Fetch this worker\'s own recent customer reviews (star rating + written feedback + the job it was for). Call this once, early, so proposal drafts can cite real, specific praise from past customers instead of generic claims.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: `Max reviews to fetch (default ${REVIEW_LIMIT}, most recent first)` },
      },
    },
  },
];

// Bumped whenever the prompt's expectations of the output shape change;
// logged at the start of each run so a prompt/schema mismatch is
// traceable in the step log without needing a dedicated DB column.
const PROPOSAL_PROMPT_VERSION = 'proposal-v2-no-standalone-tools';

const SYSTEM_PROMPT = `You are an intelligent Proposal Agent for Fixly in Sri Lanka.
Goal: help a worker pick the jobs worth applying to and write proposals that actually win them.

Process:
1. get_worker_profile — note the worker's skills, bio, rate.
2. recall_worker_memory (scope: "proposal_prefs").
3. get_my_reviews — read the worker's own past customer feedback. Pull out concrete, recurring praise (e.g. "always on time", "left the site spotless", "fixed what two others couldn't") to reuse as evidence in proposals.
4. get_open_jobs — each job already includes its own objective_score (a formula-based signal, not a verdict); for each promising job, READ THE FULL DESCRIPTION, not just the title and category. Notice specifics: materials, access constraints, deadlines, the customer's tone and priorities.
5. Rank the jobs. Give each a final score 0–1 starting from objective_score, adjusted for how well the description actually matches this worker's proven strengths and how winnable it looks (fewer existing proposals, clearer scope).
6. Write each proposal_draft yourself, directly in your final JSON, to speak to that specific job's description and cite real evidence from the worker's reviews — not a generic template.

${PROMPT_SAFETY_NOTE}

Output Format (ONLY valid JSON):
{
  "overall_reasoning": "How you chose these jobs and what evidence you used",
  "recommendations": [
    {
      "job_id": "<uuid>",
      "rank": 1,
      "score": 0.88,
      "ai_rationale": "Why this job fits — reference the description and the worker's track record",
      "key_strengths": ["description calls for tiling, worker praised for tiling in 6 reviews", "only 1 competing proposal"],
      "proposal_draft": "A specific, evidence-backed message for this exact job"
    }
  ]
}`;

async function getWorkerProfile(workerId) {
  const worker = await repository.agentWorker(workerId);
  if (!worker) return null;
  worker.skills = await repository.agentWorkerSkills(workerId);
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
      for (const j of jobs) jobCache[j.id] = j; // cache the untouched row; scoring never reads description
      const worker = workerCache.current || await getWorkerProfile(workerId);
      return {
        count: jobs.length,
        note: UNTRUSTED_TEXT_NOTE,
        jobs: jobs.map(j => {
          const { total, factors } = worker ? scoreJobForWorker(j, worker) : { total: null, factors: null };
          return {
            ...j,
            description: redactText(j.description),
            description_contains_non_latin_text: containsNonLatinScript(j.description),
            objective_score: total,
            objective_factors: factors,
          };
        }),
      };
    },

    async get_my_reviews({ limit = REVIEW_LIMIT }) {
      const reviews = await getWorkerReviews(workerId, limit);
      return {
        review_count: reviews.length,
        note: UNTRUSTED_TEXT_NOTE,
        reviews: reviews.map(r => ({
          rating: r.rating,
          feedback: redactText(r.feedback),
          contains_non_latin_text: containsNonLatinScript(r.feedback),
          job_title: r.job_title,
          job_category: r.job_category,
          created_at: r.created_at,
        })),
      };
    },
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────
/**
 * Fast, synchronous half: create the run row and validate the worker
 * profile, leaving it 'pending'. The actual work happens later in
 * executeProposalRun, off the request path, once the in-process worker
 * claims it. Fails fast (before creating a row) only when Gemini isn't
 * configured at all - a deployment/config issue, deliberately loud rather
 * than degraded. A *configured* Gemini failing at request time degrades
 * instead (see buildDegradedProposalFallback below).
 */
async function createProposalRun(workerId) {
  if (!isGeminiKeyConfigured()) {
    throw new Error('AI matching is currently unavailable');
  }

  const run = await repository.createRun(workerId, 'proposal', `Find best job opportunities for worker ${workerId}`);
  try {
    const worker = await getWorkerProfile(workerId);
    if (!worker) throw new Error('Worker profile not found');
  } catch (err) {
    await repository.failRun(run.id);
    throw err;
  }
  return { run_id: run.id, status: 'pending' };
}

/**
 * Honest degraded state, mirroring matchAgent.js's buildDegradedMatchFallback:
 * used only when the Gemini call/validation chain itself fails. Sorts by
 * the same objective formula every job already carries, with a factual,
 * templated draft (draftProposalMessage - the same function used when
 * Gemini's own JSON simply omits proposal_draft for one recommendation),
 * never phrased as AI reasoning.
 */
async function buildDegradedProposalFallback(worker, runId, logStep) {
  const jobs = await getOpenJobsForWorker(worker.id, { limit: 100 });
  await logStep(1, 'degraded_fallback', { reason: 'gemini_unavailable' }, { count: jobs.length });

  const scored = jobs
    .map(job => ({ job, ...scoreJobForWorker(job, worker) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const recommendations = [];
  for (let i = 0; i < scored.length; i++) {
    const { job, total, factors } = scored[i];
    const proposalDraft = draftProposalMessage(job, worker);
    const rationale = `${job.category_name || 'Category'} match · ${job.district || 'local'} · ${job.proposal_count || 0} existing proposals`;
    const keyStrengths = [job.category_name || 'Category match', job.district || 'Location match'];
    const recResult = await repository.addRecommendation(runId, 'job', job.id, total, factors, rationale, i + 1, keyStrengths, proposalDraft);
    recommendations.push({ recommendation_id: recResult.id, rank: i + 1, score: total, factors, rationale, key_strengths: keyStrengths, proposal_draft: proposalDraft, job });
  }

  const overallReasoning = 'Our AI matching is temporarily unavailable, so these jobs are sorted by fit score and competition instead of personalized analysis. Try again shortly for AI-powered recommendations.';
  const plan = ['Load worker profile', 'AI matching unavailable — using a formula-sorted list', 'Await confirmation', 'Submit proposals'];

  await repository.awaitConfirmation(runId, plan, overallReasoning);
  await repository.completeRunTelemetry(runId, { engine: 'degraded' });

  return {
    run_id: runId,
    status: 'awaiting_confirmation',
    plan,
    steps: [{ stepIndex: 1, stepName: 'degraded_fallback', decision: 'AI unavailable, used formula-based fallback' }],
    overall_reasoning: overallReasoning,
    engine: 'degraded',
    model_used: null,
    worker: { id: worker.id, full_name: worker.full_name, primary_skill: worker.primary_skill },
    recommendations,
  };
}

/**
 * Heavy half: runs the actual Gemini proposal search for an already-created
 * run row. Called only by the worker. A failure in the Gemini call/
 * validation chain specifically falls through to
 * buildDegradedProposalFallback; a failure anywhere else still fails the
 * run hard.
 * @param {{ id: string, user_id: string }} run
 */
async function executeProposalRun(run) {
  const runId = run.id;
  const workerId = run.user_id;

  const loggedSteps = [];
  async function logStep(stepIndex, stepName, input, output, decision = null) {
    await repository.addStep(runId, stepIndex, stepName, input, output, decision);
    loggedSteps.push({ stepIndex, stepName, decision });
  }

  try {
    const worker = await getWorkerProfile(workerId);
    if (!worker) throw new Error('Worker profile not found');

    try {
      const workerCache = { current: worker };
      const jobCache = {};
      let stepIndex = 1;

      console.info(`[proposal-agent] run ${runId} using prompt ${PROPOSAL_PROMPT_VERSION}`);

      const { text: geminiText, telemetry } = await runGeminiAgent({
        systemInstruction: SYSTEM_PROMPT,
        userPrompt: `Find top jobs for worker ID ${workerId}`,
        tools: PROPOSAL_TOOLS,
        toolHandlers: buildToolHandlers({ workerId, workerCache, jobCache }),
        // No safety net left if this runs out of room, so a bit more
        // headroom than the bare minimum the process needs.
        maxIterations: 18,
        onStep: async (step) => {
          await logStep(stepIndex++, step.stepName, step.input, step.output, null);
        },
      });

      const validation = proposalAgentOutputSchema.safeParse(parseJsonFromText(geminiText));
      if (!validation.success) {
        throw new Error(`Gemini output failed schema validation: ${validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      const parsed = validation.data;
      // Defense-in-depth, before anything is written: drop only the
      // recommendations that trip a guardrail, not the whole output.
      const { recommendations: survivors, rejected } = filterHallucinationRedFlags(parsed, rec => {
        const job = jobCache[rec.job_id];
        return job ? scoreJobForWorker(job, worker).total : null;
      });
      if (rejected.length > 0) {
        await logStep(stepIndex++, 'guardrail_rejected', {}, { count: rejected.length, reasons: rejected.map(r => r.reason) });
      }
      if (survivors.length === 0) {
        throw new Error('Gemini returned no trustworthy recommendations');
      }

      const recommendations = [];
      for (let i = 0; i < survivors.length; i++) {
        const rec = survivors[i];
        const job = jobCache[rec.job_id];
        if (!job) continue;

        const { factors } = scoreJobForWorker(job, worker);
        const keyStrengths = rec.key_strengths || [];
        const proposalDraft = rec.proposal_draft || draftProposalMessage(job, worker);
        const recResult = await repository.addRecommendation(runId, 'job', job.id, rec.score, factors, rec.ai_rationale, rec.rank || i + 1, keyStrengths, proposalDraft);

        recommendations.push({
          recommendation_id: recResult.id,
          rank: rec.rank || i + 1,
          score: rec.score,
          factors,
          rationale: rec.ai_rationale,
          key_strengths: keyStrengths,
          proposal_draft: proposalDraft,
          job,
        });
      }

      const plan = [
        'Load worker profile',
        'Read the worker\'s own review history',
        'Fetch open jobs & read descriptions',
        'AI ranking and evidence-backed drafting',
        'Await confirmation',
        'Submit proposals',
      ];

      await repository.awaitConfirmation(runId, plan, parsed.overall_reasoning);
      await repository.completeRunTelemetry(runId, {
        engine: 'gemini',
        modelUsed: telemetry.modelUsed,
        latencyMs: telemetry.latencyMs,
        promptTokens: telemetry.promptTokens,
        completionTokens: telemetry.completionTokens,
        totalTokens: telemetry.totalTokens,
        iterationCount: telemetry.iterationCount,
      });

      return {
        run_id: runId,
        status: 'awaiting_confirmation',
        plan,
        steps: loggedSteps,
        overall_reasoning: parsed.overall_reasoning,
        engine: 'gemini',
        model_used: telemetry.modelUsed,
        worker: { id: worker.id, full_name: worker.full_name, primary_skill: worker.primary_skill },
        recommendations,
      };
    } catch (geminiErr) {
      console.warn(`[proposal-agent] run ${runId} Gemini path failed, using degraded fallback:`, geminiErr.message);
      return await buildDegradedProposalFallback(worker, runId, logStep);
    }
  } catch (err) {
    await repository.failRun(runId);
    throw err;
  }
}

async function confirmProposalAgent(runId, workerId, selections) {
  const { confirmProposalAgent: confirm } = require('../modules/marketplace/service');
  return confirm({ runId, worker: { id: workerId }, selections });
}

module.exports = { createProposalRun, executeProposalRun, confirmProposalAgent };
