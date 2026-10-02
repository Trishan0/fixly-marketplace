/**
 * proposalDrafts.js — Checks an AI-written proposal draft before a worker
 * sees it.
 *
 * A draft is sent under the worker's name, so a customer reads every
 * sentence as the worker's own claim. The model is told to use only facts
 * from the worker's profile, their reviews and the job, but that's a
 * request, not a guarantee. These checks enforce the parts code can check:
 *
 * - Every number in the draft (years, jobs done, ratings, rupees, counts)
 *   must appear in that evidence. "10 years of experience" from a worker
 *   whose profile never says so is exactly the invention this catches.
 * - No contact details: they're shared only after hiring.
 * - No promises about when: availability is a separate field the worker
 *   fills in themselves when they confirm.
 *
 * A draft that fails is replaced by the plain template draft
 * (scoring.js draftProposalMessage), which only states profile facts.
 */

'use strict';

const { redactText } = require('./redact');

// Promises about when, in every language drafts are written in: "I can
// come today" / "I'll be there tomorrow", Singlish "heta enna puluwan",
// Sinhala "අද එන්න පුළුවන්", Tamil "நாளை வர முடியும்", Tanglish
// "naalaiku varen". (No \b around Sinhala/Tamil: it only knows Latin
// letters.)
const TIMING_PROMISES = [
  /\b(i\s*can|i\s*will|i'll|i am able to|i'm able to|available|ready to)\b[^.!?\n]{0,60}\b(today|tonight|tomorrow|this week|right away|immediately|asap|within)\b/i,
  /\b(ada|adha|ada ma|heta|dan|dhan|ikmanata|ikmanin)\b[^.!?\n]{0,40}\b(enna|ennam|ennang|ennan|enawa|ennai|puluwan|pluwan)\b/i,
  /(අද|හෙට|දැන්|ඉක්මනින්)[^.!?\n]{0,40}(එන්න|එන්නම්|එනවා|පුළුවන්)/,
  /(இன்று|இன்னைக்கு|நாளை|உடனே|உடனடியாக)[^.!?\n]{0,40}(வர|வருவேன்|வந்து|முடியும்)/,
  /\b(inniki|innaiku|innaikku|naalaiku|naalaikku|naalai|udane)\b[^.!?\n]{0,40}\b(varen|varuven|varuvein|vara|vandhu|mudiyum)\b/i,
];

const NUMBER = /\d+(?:[.,]\d+)*/g;

/** Numbers as comparable values: "4,500" -> 4500, "4.90" -> 4.9. */
function numbersIn(text) {
  return (String(text ?? '').match(NUMBER) || [])
    .map(raw => Number(raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')))
    .filter(Number.isFinite);
}

/**
 * Every number the draft may mention: from the worker's profile, their
 * reviews (including star ratings and the review count) and this job.
 * @param {{ worker: object, reviews?: object[], job: object }} evidence
 * @returns {Set<number>}
 */
function allowedNumbers({ worker, reviews = [], job }) {
  const sources = [
    worker.total_jobs_done, worker.avg_rating, worker.starting_price, worker.bio,
    reviews.length,
    ...reviews.flatMap(review => [review.rating, review.feedback, review.job_title]),
    job.title, job.description, job.fixed_budget, job.proposal_count,
  ];
  const allowed = new Set();
  for (const source of sources) for (const value of numbersIn(source)) allowed.add(value);
  return allowed;
}

/**
 * @param {string} draft
 * @param {{ worker: object, reviews?: object[], job: object }} evidence
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function checkDraft(draft, evidence) {
  const reasons = [];
  const allowed = allowedNumbers(evidence);
  const unsupported = numbersIn(draft).filter(value => !allowed.has(value));
  if (unsupported.length > 0) reasons.push(`numbers not in the worker's profile, reviews or the job: ${[...new Set(unsupported)].join(', ')}`);
  if (redactText(draft) !== draft) reasons.push('contains contact details');
  if (TIMING_PROMISES.some(pattern => pattern.test(draft))) reasons.push('promises a time; availability is set by the worker');
  return { ok: reasons.length === 0, reasons };
}

module.exports = { checkDraft, allowedNumbers, numbersIn };
