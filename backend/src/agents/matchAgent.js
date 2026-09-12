/**
 * matchAgent.js — Customer-side Job Match Agent (Gemini-powered).
 *
 * The formula (scoring.js) is never a gate or a silent substitute ranking
 * engine here - it's one transparent input signal the model weighs
 * alongside bios and review text, over the *entire* eligible pool, not a
 * pre-cut shortlist. When Gemini itself is unreachable or its output can't
 * be trusted (schema/guardrail failure), the run falls through to
 * buildDegradedMatchFallback: an honestly-labeled, rating-sorted list -
 * never persisted or shown as if it were AI reasoning - so the feature
 * degrades instead of going dark during a Gemini outage.
 */

const repository = require('../modules/agents/repository');
const { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured } = require('./gemini');
const { getJobDetails } = require('./tools/getJobDetails');
const { getCandidateWorkers } = require('./tools/getCandidateWorkers');
const { getWorkerReviews, REVIEW_LIMIT, UNTRUSTED_TEXT_NOTE, PROMPT_SAFETY_NOTE } = require('./tools/getWorkerReviews');
const { scoreWorkerForJob, scoreAllWorkersForJob } = require('./scoring');
const { getMemory } = require('./memory');
const { redactText, containsNonLatinScript } = require('./redact');
const { getCached, setCached } = require('./cache');
const { matchAgentOutputSchema, filterHallucinationRedFlags } = require('./schemas');

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
    description: 'Returns every eligible worker for this job (not a pre-filtered shortlist). Each entry includes bio, objective_score/objective_factors (a formula-based signal, not a verdict), and review-distribution stats: positive_review_count, negative_review_count, and recent_avg_rating. Optionally pass a district to bias the pool.',
    parameters: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Bias the candidate pool toward this district (optional)' },
      },
    },
  },
  {
    name: 'get_worker_reviews',
    description: 'Fetch a worker\'s recent customer reviews (star rating + written feedback + the job it was for) — the actual qualitative signal. Call this for whichever candidates deserve a closer look.',
    parameters: {
      type: 'object',
      properties: {
        worker_id: { type: 'string', description: 'ID of the worker whose reviews to read' },
        limit: { type: 'number', description: `Max reviews to fetch (default ${REVIEW_LIMIT}, most recent first)` },
      },
      required: ['worker_id'],
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

// Bumped whenever the prompt's expectations of the output shape change;
// logged at the start of each run so a prompt/schema mismatch is
// traceable in the step log without needing a dedicated DB column.
const MATCH_PROMPT_VERSION = 'match-v2-full-pool';

const SYSTEM_PROMPT = `You are an intelligent Job Matching Agent for Fixly marketplace in Sri Lanka.
Goal: recommend the workers a customer should invite, judged the way a careful human would — not by a formula alone.

Process:
1. get_job_details — read the full description, not just the category. Note specifics: materials, access constraints, timing, tone, anything unusual.
2. recall_customer_memory (scope: "match_prefs").
3. get_candidate_workers — returns EVERY eligible worker, not a pre-filtered shortlist. Each has objective_score/objective_factors (one input signal, not a verdict), plus positive_review_count, negative_review_count, and recent_avg_rating.
4. A flat avg_rating or job count can hide a real pattern: a worker with many reviews split heavily toward negative_review_count is a red flag even if the average looks passable; a worker with few total jobs but all-positive reviews may be a strong, underexposed candidate a formula alone would rank low. Use these fields to decide which candidates are worth a closer look — you do not need to check everyone equally.
5. For every candidate you're seriously considering, call get_worker_reviews and actually read the written feedback. Look for recurring themes: repeated praise (punctuality, tidiness, skill on this exact kind of work) vs. repeated concerns (no-shows, price disputes, quality complaints).
6. Rank the workers and give each a final score from 0 to 1. Start from objective_score, then adjust based on what the bio, the job description, and the reviews actually tell you. If your score differs from objective_score by more than ~0.15, explain why in ai_rationale. A large, evidence-backed adjustment (in either direction) is expected and fine — that's the point of reading the reviews, not a mistake to avoid.

${PROMPT_SAFETY_NOTE}

Output Format (ONLY valid JSON):
{
  "overall_reasoning": "How you weighed objective fit vs. what the reviews and descriptions told you",
  "recommendations": [
    {
      "worker_id": "<uuid>",
      "rank": 1,
      "score": 0.92,
      "ai_rationale": "Specific, evidence-based reason — cite what the reviews or bio actually said",
      "key_strengths": ["consistently praised for tiling", "same district", "no red flags across 18 reviews"]
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
        description: redactText(job.description),
        category_name: job.category_name,
        category_id: job.category_id,
        district: job.district,
        urgency: job.urgency,
        pricing_mode: job.pricing_mode,
        fixed_budget: job.fixed_budget,
      };
    },

    async get_candidate_workers({ district }) {
      const job = jobCache.current;
      const searchDistrict = district || job.district || null;

      // Cache the raw pool (before per-job scoring, which stays cheap and
      // always fresh) so near-simultaneous jobs in the same district don't
      // each pay for the same DB fetch.
      const cacheKey = `candidate-pool:${searchDistrict || 'ALL'}`;
      let pool = getCached(cacheKey);
      if (!pool) {
        const inDistrict = await getCandidateWorkers({ district: searchDistrict, limit: 100 });
        // Widen to the whole platform if the district pool is too thin.
        pool = inDistrict.length >= 5 ? inDistrict : await getCandidateWorkers({ limit: 100 });
        setCached(cacheKey, pool);
      }

      const annotated = scoreAllWorkersForJob(pool, job);
      for (const { worker } of annotated) workerCache[worker.id] = worker;

      return {
        count: annotated.length,
        note: UNTRUSTED_TEXT_NOTE,
        workers: annotated.map(({ worker, total, factors }) => ({
          id: worker.id,
          full_name: worker.full_name,
          district: worker.district,
          primary_skill: worker.primary_skill,
          bio: redactText(worker.bio),
          bio_contains_non_latin_text: containsNonLatinScript(worker.bio),
          avg_rating: worker.avg_rating,
          total_jobs_done: worker.total_jobs_done,
          positive_review_count: worker.positive_review_count,
          negative_review_count: worker.negative_review_count,
          recent_avg_rating: worker.recent_avg_rating,
          starting_price: worker.starting_price,
          is_nic_verified: worker.is_nic_verified,
          objective_score: total,
          objective_factors: factors,
        })),
      };
    },

    async get_worker_reviews({ worker_id, limit = REVIEW_LIMIT }) {
      const reviews = await getWorkerReviews(worker_id, limit);
      return {
        worker_id,
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

    async recall_customer_memory({ scope }) {
      const prefDistrict = await getMemory(customerId, scope, 'preferred_district');
      return { preferred_district: prefDistrict };
    },
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────
/**
 * Fast, synchronous half: create the run row, validate the job, and leave
 * it 'pending'. The actual matching work happens later in executeMatchRun,
 * off the request path, once the in-process worker (agents/worker.js)
 * claims it. Fails fast (before creating a row) only when Gemini isn't
 * configured at all - a deployment/config issue, deliberately loud rather
 * than degraded. A *configured* Gemini failing at request time degrades
 * instead (see buildDegradedMatchFallback below).
 */
async function createMatchRun(jobId, customerId) {
  if (!isGeminiKeyConfigured()) {
    throw new Error('AI matching is currently unavailable');
  }

  const run = await repository.createRun(customerId, 'match', `Find best workers for job ${jobId}`, jobId);
  try {
    const job = await getJobDetails(jobId);
    if (!job) throw new Error('Job not found');
    if (job.customer_id !== customerId) throw new Error('Not your job');
  } catch (err) {
    await repository.failRun(run.id);
    throw err;
  }
  return { run_id: run.id, status: 'pending' };
}

/**
 * Honest degraded state: used only when the Gemini call/validation chain
 * itself fails (not when it's simply unconfigured - see createMatchRun's
 * fast-fail for that). Sorts by the same objective formula every candidate
 * already carries, purely as a tiebreaker for a plain list - the rationale
 * is built from factual fields only (rating, jobs done), never phrased as
 * if a model reasoned about it, and the run is clearly tagged engine:
 * 'degraded' so the UI can label it honestly instead of implying AI
 * involvement that didn't happen.
 */
async function buildDegradedMatchFallback(job, customerId, runId, logStep) {
  const prefDistrict = await getMemory(customerId, 'match_prefs', 'preferred_district');
  const searchDistrict = prefDistrict || job.district || null;
  const inDistrict = await getCandidateWorkers({ district: searchDistrict, limit: 100 });
  const pool = inDistrict.length >= 5 ? inDistrict : await getCandidateWorkers({ limit: 100 });

  const scored = scoreAllWorkersForJob(pool, job).sort((a, b) => b.total - a.total).slice(0, 5);
  await logStep(1, 'degraded_fallback', { reason: 'gemini_unavailable', district: searchDistrict }, { count: scored.length });

  const recommendations = [];
  for (let i = 0; i < scored.length; i++) {
    const { worker, total, factors } = scored[i];
    const ratingText = Number(worker.avg_rating) > 0 ? `${Number(worker.avg_rating).toFixed(1)}★ rating` : 'No ratings yet';
    const rationale = `${ratingText} · ${worker.total_jobs_done || 0} jobs completed`;
    const keyStrengths = [worker.primary_skill || 'Skilled worker', worker.district || 'Local area'];
    const recResult = await repository.addRecommendation(runId, 'worker', worker.id, total, factors, rationale, i + 1, keyStrengths);
    recommendations.push({ recommendation_id: recResult.id, rank: i + 1, score: total, factors, rationale, key_strengths: keyStrengths, worker });
  }

  const overallReasoning = 'Our AI matching is temporarily unavailable, so these candidates are sorted by rating and completion history instead of personalized analysis. Try again shortly for AI-powered recommendations.';
  const plan = ['Load job details', 'AI matching unavailable — using a rating-based list', 'Await customer confirmation', 'Send invites'];

  await repository.awaitConfirmation(runId, plan, overallReasoning);
  await repository.completeRunTelemetry(runId, { engine: 'degraded' });

  return {
    run_id: runId,
    status: 'awaiting_confirmation',
    plan,
    steps: [{ stepIndex: 1, stepName: 'degraded_fallback', decision: 'AI unavailable, used rating-based fallback' }],
    overall_reasoning: overallReasoning,
    engine: 'degraded',
    model_used: null,
    job: { id: job.id, title: job.title, category: job.category_name },
    recommendations,
  };
}

/**
 * Heavy half: runs the actual Gemini matching for an already-created run
 * row. Called only by the worker. A failure in the Gemini call/validation
 * chain specifically falls through to buildDegradedMatchFallback; a
 * failure anywhere else (e.g. the job vanished) still fails the run hard,
 * since that's not a Gemini-availability problem.
 * @param {{ id: string, job_id: string, user_id: string }} run
 */
async function executeMatchRun(run) {
  const runId = run.id;
  const jobId = run.job_id;
  const customerId = run.user_id;

  const loggedSteps = [];
  async function logStep(stepIndex, stepName, input, output, decision = null) {
    await repository.addStep(runId, stepIndex, stepName, input, output, decision);
    loggedSteps.push({ stepIndex, stepName, decision });
  }

  try {
    const job = await getJobDetails(jobId);
    if (!job) throw new Error('Job not found');

    try {
      const workerCache = {};
      const jobCache = { current: job };
      let stepIndex = 1;

      console.info(`[match-agent] run ${runId} using prompt ${MATCH_PROMPT_VERSION}`);

      const { text: geminiText, telemetry } = await runGeminiAgent({
        systemInstruction: SYSTEM_PROMPT,
        userPrompt: `Match workers for job ID ${jobId}. Customer ID: ${customerId}`,
        tools: MATCH_TOOLS,
        toolHandlers: buildToolHandlers({ jobId, customerId, workerCache, jobCache }),
        // Higher than the default: the agent now reasons over the full
        // eligible pool (not a pre-cut shortlist) and may read reviews for
        // several candidates before it's satisfied.
        maxIterations: 30,
        onStep: async (step) => {
          await logStep(stepIndex++, step.stepName, step.input, step.output, null);
        },
      });

      const validation = matchAgentOutputSchema.safeParse(parseJsonFromText(geminiText));
      if (!validation.success) {
        throw new Error(`Gemini output failed schema validation: ${validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      const parsed = validation.data;
      // Defense-in-depth, before anything is written: drop only the
      // recommendations that trip a guardrail, not the whole output.
      const { recommendations: survivors, rejected } = filterHallucinationRedFlags(parsed, rec => {
        const worker = workerCache[rec.worker_id];
        return worker ? scoreWorkerForJob(worker, job).total : null;
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
        const worker = workerCache[rec.worker_id];
        if (!worker) continue;

        const { factors } = scoreWorkerForJob(worker, job);
        const keyStrengths = rec.key_strengths || [];
        const recResult = await repository.addRecommendation(runId, 'worker', worker.id, rec.score, factors, rec.ai_rationale, rec.rank || i + 1, keyStrengths);

        recommendations.push({
          recommendation_id: recResult.id,
          rank: rec.rank || i + 1,
          score: rec.score,
          factors,
          rationale: rec.ai_rationale,
          key_strengths: keyStrengths,
          worker,
        });
      }

      const plan = [
        'Load job details',
        'Recall preferences',
        'Review the full eligible pool',
        'Read reviews for the strongest/most uncertain candidates',
        'AI synthesis & ranking',
        'Await customer confirmation',
        'Send invites',
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
        job: { id: job.id, title: job.title, category: job.category_name },
        recommendations,
      };
    } catch (geminiErr) {
      console.warn(`[match-agent] run ${runId} Gemini path failed, using degraded fallback:`, geminiErr.message);
      return await buildDegradedMatchFallback(job, customerId, runId, logStep);
    }
  } catch (err) {
    await repository.failRun(runId);
    throw err;
  }
}

async function confirmMatchAgent(runId, customerId, selectedWorkerIds) {
  const { confirmMatchAgent: confirm } = require('../modules/marketplace/service');
  return confirm({ runId, customerId, selections: selectedWorkerIds });
}

module.exports = { createMatchRun, executeMatchRun, confirmMatchAgent };
