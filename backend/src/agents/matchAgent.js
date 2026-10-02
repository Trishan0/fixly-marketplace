/**
 * matchAgent.js — Customer-side Job Match Agent (Gemini-powered).
 *
 * A result has two lanes (see lanes.js): up to 3 best matches, proven
 * workers the model ranks on merit, and 2 new-on-Fixly workers, verified
 * newcomers the model picks from a code-built shortlist. Both candidate
 * lists are built in code before the model runs, so it can only choose
 * from workers the rules allow.
 *
 * In the best-match lane the formula (scoring.js) is never a gate - it's
 * one transparent input signal the model weighs alongside bios and review
 * text. When Gemini itself is unreachable or its output can't be trusted
 * (schema/guardrail failure), the run falls through to
 * buildDegradedMatchFallback: the same lanes filled by the rules alone,
 * honestly labeled - never shown as if it were AI reasoning - so the
 * feature degrades instead of going dark during a Gemini outage.
 */

const repository = require('../modules/agents/repository');
const { runGeminiAgent, parseJsonFromText, isGeminiKeyConfigured, AgentRunCancelledError } = require('./gemini');
const { getJobDetails } = require('./tools/getJobDetails');
const { getCandidateWorkers } = require('./tools/getCandidateWorkers');
const { getWorkerReviews, REVIEW_LIMIT, UNTRUSTED_TEXT_NOTE, PROMPT_SAFETY_NOTE } = require('./tools/getWorkerReviews');
const { scoreAllWorkersForJob } = require('./scoring');
const { getMemory } = require('./memory');
const { redactText, containsNonLatinScript } = require('./redact');
const { getCached, setCached } = require('./cache');
const { matchAgentOutputSchema, filterHallucinationRedFlags, findInjectionMarker } = require('./schemas');
const lanes = require('./lanes');
const { createNotification } = require('../services/notificationDispatch');

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
    description: 'Returns the two candidate lists for this job. best_match_candidates: every eligible proven worker (3+ completed jobs) in the job\'s trade, each with bio, objective_score/objective_factors (a formula-based signal, not a verdict), and review-distribution stats. new_talent_candidates: a shortlist of ID-verified workers new to Fixly (fewer than 3 completed jobs) in the job\'s trade, with a fit_score from code. Also returns how many places each list fills.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_worker_reviews',
    description: 'Fetch a worker\'s recent customer reviews (star rating + written feedback + the job it was for) — the actual qualitative signal. Call this for whichever best-match candidates deserve a closer look.',
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
const MATCH_PROMPT_VERSION = 'match-v3-lanes';

const SYSTEM_PROMPT = `You are an intelligent Job Matching Agent for Fixly marketplace in Sri Lanka.
Goal: recommend the workers a customer should invite, judged the way a careful human would — not by a formula alone.

Fixly shows two groups of workers, and you fill both:
- Best matches: proven workers, ranked on merit.
- New on Fixly: ID-verified workers with fewer than 3 completed jobs. Customers see them in a separate, clearly labeled group. They give new workers a fair start; they are not a reward for anything.

Process:
1. get_job_details — read the full description, not just the category. Note specifics: materials, access constraints, timing, tone, anything unusual.
2. recall_customer_memory (scope: "match_prefs").
3. get_candidate_workers — returns best_match_candidates, new_talent_candidates, and slots (how many of each to pick).
4. Best matches. Each candidate has objective_score/objective_factors (one input signal, not a verdict), plus positive_review_count, negative_review_count, and recent_avg_rating. A flat avg_rating or job count can hide a real pattern: many reviews split heavily toward negative_review_count is a red flag even if the average looks passable. Use these fields to decide which candidates are worth a closer look.
5. For every best-match candidate you're seriously considering, call get_worker_reviews and actually read the written feedback. Look for recurring themes: repeated praise (punctuality, tidiness, skill on this exact kind of work) vs. repeated concerns (no-shows, price disputes, quality complaints).
6. Rank up to slots.best_match workers from best_match_candidates ONLY and give each a final score from 0 to 1. Start from objective_score, then adjust based on what the bio, the job description, and the reviews actually tell you. If your score differs from objective_score by more than ~0.15, explain why in ai_rationale.
7. New on Fixly. Pick up to slots.new_talent workers from new_talent_candidates ONLY. They have no reviews, so judge how well their bio, skills and portfolio fit this specific job. Do not score them. In ai_rationale say what in their profile fits this job; never claim experience, reviews or a track record they don't have.
8. Starting prices are optional guide prices set by workers; the real price is agreed per job. Never rank anyone by price.

${PROMPT_SAFETY_NOTE}

Output Format (ONLY valid JSON):
{
  "overall_reasoning": "How you weighed objective fit vs. what the reviews and descriptions told you",
  "recommendations": [
    {
      "worker_id": "<uuid from best_match_candidates>",
      "rank": 1,
      "score": 0.92,
      "ai_rationale": "Specific, evidence-based reason — cite what the reviews or bio actually said",
      "key_strengths": ["consistently praised for tiling", "same district", "no red flags across 18 reviews"]
    }
  ],
  "new_talent": [
    {
      "worker_id": "<uuid from new_talent_candidates>",
      "ai_rationale": "What in their profile fits this job",
      "key_strengths": ["bathroom tiling is their main skill", "same district"]
    }
  ]
}`;

/**
 * Both candidate lists for a job, built by the rules before the model
 * runs (and reused as-is if it fails).
 * @returns {Promise<{ bestPool: object[], shortlist: object[], newcomers: object[] }>}
 */
async function loadLanePools(job) {
  const district = job.district || null;
  const categoryId = job.category_id || null;

  let platformAvgRating = getCached('platform-avg-rating');
  if (platformAvgRating === undefined) {
    platformAvgRating = (await repository.platformAverageRating())?.avg_rating ?? null;
    setCached('platform-avg-rating', platformAvgRating);
  }

  // Cache the raw proven-worker pool (before per-job scoring, which stays
  // cheap and always fresh) so near-simultaneous jobs in the same district
  // and trade don't each pay for the same DB fetch.
  const cacheKey = `candidate-pool:${district || 'ALL'}:${categoryId || 'ANY'}`;
  let pool = getCached(cacheKey);
  if (!pool) {
    const query = (d) => getCandidateWorkers({ district: d, categoryId, minJobsDone: lanes.NEW_WORKER_MAX_JOBS, limit: 100 });
    const inDistrict = await query(district);
    // Widen to the whole platform if the district pool is too thin.
    pool = inDistrict.length >= lanes.LANE_SIZES.best_match || !district ? inDistrict : await query(null);
    setCached(cacheKey, pool);
  }
  const bestPool = scoreAllWorkersForJob(pool, job, { platformAvgRating });

  // Newcomers depend on this job (already invited / applied), so they're
  // never cached. Same district first, the whole platform if too few.
  const newcomerQuery = (d) => repository.newcomerCandidates({
    jobId: job.id, categoryId, district: d,
    maxJobsDone: lanes.NEW_WORKER_MAX_JOBS, minBioLength: lanes.MIN_BIO_LENGTH,
    inviteResponseDays: lanes.INVITE_RESPONSE_DAYS, lookbackDays: lanes.LOOKBACK_DAYS, limit: 200,
  });
  let newcomers = await newcomerQuery(district);
  if (newcomers.length < lanes.LANE_SIZES.new_talent && district) {
    const seen = new Set(newcomers.map(n => n.id));
    newcomers = [...newcomers, ...(await newcomerQuery(null)).filter(n => !seen.has(n.id))];
  }

  return { bestPool, shortlist: lanes.shortlistNewcomers(newcomers, job), newcomers };
}

/**
 * Newcomers who've been moved to the back of the rotation get one
 * notification with what to improve, until their next profile update or
 * invite resets it. Never blocks or fails the run.
 */
async function sendMatchingTips(newcomers) {
  const due = newcomers.filter(n => lanes.isDeprioritized(n) && !n.tip_sent);
  await Promise.all(due.map(n => createNotification(
    n.id,
    'matching_tip',
    'Customers are seeing your profile',
    'You’ve been suggested to customers several times without an invite yet. Profiles with 3 or more portfolio photos, a detailed bio about the work you do, and quick replies to invites get chosen more often. Updating your profile also moves you back up in suggestions.',
    { link: '/profile/edit' },
  )));
}

/** Persist the assembled lanes as recommendations, in rank order. */
async function saveLaneRecommendations(runId, assembled) {
  const recommendations = [];
  for (const item of assembled) {
    const recResult = await repository.addRecommendation(
      runId, 'worker', item.worker.id, item.score, item.factors, item.rationale, item.rank, item.key_strengths, null, item.lane,
    );
    recommendations.push({
      recommendation_id: recResult.id,
      rank: item.rank,
      lane: item.lane,
      score: item.score,
      factors: item.factors,
      rationale: item.rationale,
      key_strengths: item.key_strengths,
      worker: item.worker,
    });
  }
  return recommendations;
}

function buildToolHandlers({ jobId, customerId, workerCache, jobCache, pools }) {
  return {
    async get_job_details({ job_id }) {
      // Always this run's job: the candidate lists were built for it.
      const job = jobCache.current || await getJobDetails(job_id || jobId);
      if (!job) return { error: 'Job not found' };
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

    async get_candidate_workers() {
      for (const { worker } of pools.bestPool) workerCache[worker.id] = worker;
      return {
        note: UNTRUSTED_TEXT_NOTE,
        slots: lanes.LANE_SIZES,
        best_match_candidates: pools.bestPool.map(({ worker, total, factors }) => ({
          id: worker.id,
          full_name: worker.full_name,
          district: worker.district,
          primary_skill: worker.primary_skill,
          bio: redactText(worker.bio),
          bio_contains_non_latin_text: containsNonLatinScript(worker.bio),
          avg_rating: worker.avg_rating,
          total_jobs_done: worker.total_jobs_done,
          review_count: worker.review_count,
          positive_review_count: worker.positive_review_count,
          negative_review_count: worker.negative_review_count,
          recent_avg_rating: worker.recent_avg_rating,
          starting_price_guide: worker.starting_price,
          is_nic_verified: worker.is_nic_verified,
          objective_score: total,
          objective_factors: factors,
        })),
        new_talent_candidates: pools.shortlist.map(({ worker, total, factors }) => ({
          id: worker.id,
          full_name: worker.full_name,
          district: worker.district,
          primary_skill: worker.primary_skill,
          skills: (worker.skills || []).map(skill => skill.category_name),
          bio: redactText(worker.bio),
          bio_contains_non_latin_text: containsNonLatinScript(worker.bio),
          portfolio_photo_count: worker.portfolio_count,
          total_jobs_done: worker.total_jobs_done,
          fit_score: total,
          fit_factors: factors,
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
 * fast-fail for that). Fills both lanes by the rules alone: best matches
 * by the objective formula, new talent by the shortlist order. Rationales
 * are factual fields only, never phrased as if a model reasoned about it,
 * and the run is tagged engine: 'degraded' so the UI can label it honestly.
 */
async function buildDegradedMatchFallback(job, runId, pools, logStep) {
  const assembled = lanes.assembleLanes({ bestPool: pools.bestPool, shortlist: pools.shortlist });
  await logStep(1, 'degraded_fallback', { reason: 'gemini_unavailable', district: job.district }, {
    best_match: assembled.filter(item => item.lane === 'best_match').length,
    new_talent: assembled.filter(item => item.lane === 'new_talent').length,
  });
  const recommendations = await saveLaneRecommendations(runId, assembled);

  const overallReasoning = 'Our AI matching is temporarily unavailable, so best matches are sorted by rating, experience and location instead of personalized analysis, and new workers are chosen by how well their profile fits this job. Try again shortly for AI-powered recommendations.';
  const plan = ['Load job details', 'AI matching unavailable — using rule-based lists', 'Await customer confirmation', 'Send invites'];

  await repository.awaitConfirmation(runId, plan, overallReasoning);
  await repository.completeRunTelemetry(runId, { engine: 'degraded' });

  return {
    run_id: runId,
    status: 'awaiting_confirmation',
    plan,
    steps: [{ stepIndex: 1, stepName: 'degraded_fallback', decision: 'AI unavailable, used rule-based lanes' }],
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
    const pools = await loadLanePools(job);
    sendMatchingTips(pools.newcomers).catch(err => console.error(`[match-agent] run ${runId} matching tips failed:`, err.message));

    try {
      const workerCache = {};
      const jobCache = { current: job };
      let stepIndex = 1;

      console.info(`[match-agent] run ${runId} using prompt ${MATCH_PROMPT_VERSION}`);

      const { text: geminiText, telemetry } = await runGeminiAgent({
        systemInstruction: SYSTEM_PROMPT,
        userPrompt: `Match workers for job ID ${jobId}. Customer ID: ${customerId}`,
        tools: MATCH_TOOLS,
        toolHandlers: buildToolHandlers({ jobId, customerId, workerCache, jobCache, pools }),
        shouldStop: () => repository.isRunCancelled(runId),
        // Higher than the default: the agent reasons over the full
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
      const objectiveById = new Map(pools.bestPool.map(entry => [entry.worker.id, entry.total]));
      const { recommendations: survivors, rejected } = filterHallucinationRedFlags(parsed, rec => objectiveById.get(rec.worker_id));
      const newTalentPicks = parsed.new_talent.filter(pick => {
        const marker = findInjectionMarker(pick);
        if (marker) rejected.push({ rec: pick, reason: marker });
        return !marker;
      });
      if (rejected.length > 0) {
        await logStep(stepIndex++, 'guardrail_rejected', {}, { count: rejected.length, reasons: rejected.map(r => r.reason) });
      }
      if (survivors.length === 0 && pools.bestPool.length > 0 && newTalentPicks.length === 0) {
        throw new Error('Gemini returned no trustworthy recommendations');
      }

      // The model only chooses within the lists; the rules fill any gap.
      const assembled = lanes.assembleLanes({ bestPool: pools.bestPool, shortlist: pools.shortlist, aiBest: survivors, aiNew: newTalentPicks });
      const filledByRules = assembled.filter(item => item.source === 'rules').length;
      if (filledByRules > 0) {
        await logStep(stepIndex++, 'lane_backfill', {}, { filled_by_rules: filledByRules });
      }
      const recommendations = await saveLaneRecommendations(runId, assembled);

      const plan = [
        'Load job details',
        'Recall preferences',
        'Build best-match and new-talent lists',
        'Read reviews for the strongest/most uncertain candidates',
        'AI synthesis & ranking',
        'Pick new workers whose profiles fit this job',
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
      if (geminiErr instanceof AgentRunCancelledError) throw geminiErr;
      console.warn(`[match-agent] run ${runId} Gemini path failed, using degraded fallback:`, geminiErr.message);
      return await buildDegradedMatchFallback(job, runId, pools, logStep);
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

module.exports = { createMatchRun, executeMatchRun, confirmMatchAgent, loadLanePools };
