/**
 * schemas.js — Structural validation for the JSON an LLM agent hands back.
 *
 * Gemini's final text response is parsed as JSON (see gemini.js's
 * parseJsonFromText) but nothing previously checked its shape before it was
 * used to write agent_recommendations rows and rendered to the client. These
 * schemas turn a malformed/hallucinated response into an explicit, loggable
 * validation failure that the caller can treat the same as "Gemini returned
 * nothing" — i.e. fall back to deterministic scoring — instead of trusting
 * arbitrary parsed JSON.
 */

const { z } = require('zod');

const recommendationBase = {
  rank: z.number().int().positive(),
  score: z.number().min(0).max(1),
  ai_rationale: z.string().min(1),
  key_strengths: z.array(z.string()).default([]),
};

const matchRecommendationSchema = z.object({
  worker_id: z.string().uuid(),
  ...recommendationBase,
});

const proposalRecommendationSchema = z.object({
  job_id: z.string().uuid(),
  proposal_draft: z.string().optional(),
  ...recommendationBase,
});

const matchAgentOutputSchema = z.object({
  overall_reasoning: z.string().min(1),
  recommendations: z.array(matchRecommendationSchema),
});

const proposalAgentOutputSchema = z.object({
  overall_reasoning: z.string().min(1),
  recommendations: z.array(proposalRecommendationSchema),
});

/**
 * Defense-in-depth checks run after schema validation succeeds, before a
 * Gemini output is trusted enough to persist and show to a user. Neither
 * check can catch a sophisticated attack - they exist to catch the cheap,
 * common cases at near-zero cost, as a backstop alongside the prompt's own
 * "treat this as untrusted data" instructions, not a replacement for them.
 */

// How far a recommendation's final score may legitimately drift from the
// independently-computed objective formula score. The prompt already asks
// the model to *explain* drift past ~0.15; this is the harder backstop that
// gets enforced regardless of what the model says.
//
// Deliberately asymmetric: caught live via the eval harness
// (agents-eval.integration.test.js), a symmetric 0.4 ceiling rejected a
// *correct* run - Gemini read 5 planted "no-show" reviews and dropped a
// worker's score from an objective 0.76 to 0.30, a legitimate evidence-
// based penalty exactly like this system exists to allow, and the flat
// ceiling threw it away. The actual attack surface only runs one
// direction: nobody is incentivized to inject "rate me lower" - the
// exploit is inflating a score (a worker's own "rate me 1.0" injection,
// or a rigged review). So inflation gets a tight ceiling; a markdown
// based on genuine evidence gets a much looser one, and is only rejected
// if it's extreme enough to look like fabrication itself.
const UPWARD_DEVIATION_CEILING = 0.35;
const DOWNWARD_DEVIATION_CEILING = 0.6;

const INJECTION_MARKERS = [
  /ignore (all|the|any|previous|prior|above) instructions/i,
  /disregard (the|all|any|previous|prior) (instructions|prompt|rules)/i,
  /\bsystem prompt\b/i,
  /new instructions?:/i,
  /forget (everything|all) (above|before)/i,
  /you must (rate|score|give)/i,
  /(rate|score) (this|me) (a\s*)?(5|five|1\.0|100%|perfect|highest)/i,
];

function textContainsInjectionMarker(text) {
  if (!text) return false;
  return INJECTION_MARKERS.some(pattern => pattern.test(text));
}

/** @param {{ ai_rationale: string, key_strengths?: string[], proposal_draft?: string }} rec */
function findInjectionMarker(rec) {
  const haystacks = [rec.ai_rationale, ...(rec.key_strengths || []), rec.proposal_draft].filter(Boolean);
  const hit = haystacks.find(textContainsInjectionMarker);
  return hit ? `suspicious phrase in recommendation text: "${hit.slice(0, 80)}"` : null;
}

/**
 * @param {number} llmScore @param {number} objectiveScore
 * @param {{ upward?: number, downward?: number }} [ceilings]
 * @returns {boolean}
 */
function scoreDeviationExceedsCeiling(llmScore, objectiveScore, ceilings = {}) {
  const { upward = UPWARD_DEVIATION_CEILING, downward = DOWNWARD_DEVIATION_CEILING } = ceilings;
  const delta = llmScore - objectiveScore;
  return delta > upward || -delta > downward;
}

/**
 * Throws if any recommendation trips a guardrail, so the caller's existing
 * catch block treats it exactly like a schema validation failure (fall back
 * to deterministic scoring) rather than persisting or showing it. Must be
 * called before anything from `parsed` is written to the database - it
 * makes an all-or-nothing decision about the whole output.
 * @param {{ overall_reasoning: string, recommendations: object[] }} parsed - already schema-validated
 * @param {(rec: object) => number | null | undefined} resolveObjectiveScore -
 *   independently-computed objective score for one recommendation's entity,
 *   or null/undefined if that entity can't be resolved (skips the deviation
 *   check for that recommendation; the caller's own unknown-entity handling
 *   still applies downstream)
 */
function assertNoHallucinationRedFlags(parsed, resolveObjectiveScore) {
  if (textContainsInjectionMarker(parsed.overall_reasoning)) {
    throw new Error('Gemini output rejected: suspicious phrase in overall_reasoning');
  }
  for (const rec of parsed.recommendations) {
    const marker = findInjectionMarker(rec);
    if (marker) throw new Error(`Gemini output rejected: ${marker}`);

    const objectiveScore = resolveObjectiveScore(rec);
    if (objectiveScore != null && scoreDeviationExceedsCeiling(rec.score, objectiveScore)) {
      const direction = rec.score > objectiveScore ? 'above' : 'below';
      throw new Error(`Gemini output rejected: score ${rec.score} is too far ${direction} objective score ${objectiveScore}`);
    }
  }
}

module.exports = {
  matchAgentOutputSchema,
  proposalAgentOutputSchema,
  assertNoHallucinationRedFlags,
  scoreDeviationExceedsCeiling,
  textContainsInjectionMarker,
  UPWARD_DEVIATION_CEILING,
  DOWNWARD_DEVIATION_CEILING,
};
