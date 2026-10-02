/**
 * lanes.js — How a match result is split between proven workers and new
 * talent.
 *
 * A match shows up to 3 "best matches" (workers with a track record,
 * ranked on merit by the agent) and 2 "new on Fixly" workers (verified
 * workers with fewer than 3 completed jobs). Without a reserved place,
 * new workers never surface: every ranking signal - rating, jobs done,
 * reviews - is one they can't have yet.
 *
 * The rules live here, in code, not in the prompt: who is eligible is
 * decided in SQL (see agents/repository.js newcomerCandidates), who makes
 * the shortlist is decided below, and the model only chooses within that
 * shortlist and explains its choice. If the model's answer is missing or
 * unusable, the same rules fill every slot on their own.
 *
 * All functions are pure so the policy can be tested without a database.
 */

'use strict';

const { scoreNewcomerForJob } = require('./scoring');

const LANE_SIZES = Object.freeze({ best_match: 3, new_talent: 2 });

// Fewer completed jobs than this means "new". At this many the worker
// moves to the best-match lane and competes on their record.
const NEW_WORKER_MAX_JOBS = 3;

// How many eligible newcomers the model gets to choose its 2 from.
const NEWCOMER_SHORTLIST_SIZE = 6;

// Newcomers whose fit scores are within this band count as equally good,
// and rotation (least recently shown first) decides between them.
const FIT_TIE_BAND = 0.05;

// Moves a newcomer to the back of the rotation: shown this many times
// since their last profile update or invite without being invited...
const SHOWN_WITHOUT_INVITE_LIMIT = 20;
// ...or this many invites declined or left unanswered for
// INVITE_RESPONSE_DAYS, with none accepted, within LOOKBACK_DAYS.
const UNANSWERED_INVITE_LIMIT = 3;
const INVITE_RESPONSE_DAYS = 3;
const LOOKBACK_DAYS = 60;

// A bio shorter than this doesn't tell a customer anything.
const MIN_BIO_LENGTH = 30;

/**
 * True when a newcomer has had a fair chance and customers keep passing,
 * or they keep leaving invites unanswered. They stay eligible, just behind
 * everyone else, until they update their profile or get an invite.
 */
function isDeprioritized(candidate) {
  const shown = Number(candidate.shown_since_reset) || 0;
  const accepted = Number(candidate.invites_accepted) || 0;
  const unanswered = Number(candidate.invites_unanswered) || 0;
  return shown >= SHOWN_WITHOUT_INVITE_LIMIT || (accepted === 0 && unanswered >= UNANSWERED_INVITE_LIMIT);
}

function shownAtMs(candidate) {
  return candidate.last_shown_at ? new Date(candidate.last_shown_at).getTime() : 0;
}

/**
 * Score eligible newcomers for one job and keep the best few. Order:
 * deprioritized workers last; then fit, in bands of FIT_TIE_BAND; then
 * whoever was shown least recently (never shown first).
 * @param {object[]} candidates - rows from newcomerCandidates
 * @param {object} job
 */
function shortlistNewcomers(candidates, job, size = NEWCOMER_SHORTLIST_SIZE) {
  return candidates
    .map(worker => ({ worker, ...scoreNewcomerForJob(worker, job), deprioritized: isDeprioritized(worker) }))
    .sort((a, b) =>
      Number(a.deprioritized) - Number(b.deprioritized)
      || Math.floor(b.total / FIT_TIE_BAND) - Math.floor(a.total / FIT_TIE_BAND)
      || shownAtMs(a.worker) - shownAtMs(b.worker)
      || String(a.worker.id).localeCompare(String(b.worker.id)))
    .slice(0, size);
}

/**
 * Build the final, ranked result from the two pools and the model's picks.
 *
 * - Best matches: the model's ranked picks that are really in the
 *   best-match pool, then the highest objective scores to fill any gap.
 * - New talent: the model's picks that are really on the shortlist, then
 *   the shortlist in order.
 * - A lane that can't be filled gives its places to the other lane, but
 *   each worker keeps their true lane label.
 *
 * @param {{
 *   bestPool: { worker: object, total: number, factors: object, rationale: string }[],
 *   shortlist: { worker: object, total: number, factors: object, rationale: string }[],
 *   aiBest?: { worker_id: string, score: number, ai_rationale: string, key_strengths?: string[], rank?: number }[],
 *   aiNew?: { worker_id: string, ai_rationale: string, key_strengths?: string[] }[],
 *   sizes?: { best_match: number, new_talent: number },
 * }} input
 * @returns {{ lane: 'best_match' | 'new_talent', worker: object, score: number, factors: object, rationale: string, key_strengths: string[], source: 'ai' | 'rules', rank: number }[]}
 */
function assembleLanes({ bestPool, shortlist, aiBest = [], aiNew = [], sizes = LANE_SIZES }) {
  const used = new Set();
  const bestById = new Map(bestPool.map(entry => [entry.worker.id, entry]));
  const newById = new Map(shortlist.map(entry => [entry.worker.id, entry]));

  const fromAi = (pick, entry, lane, score) => ({
    lane, worker: entry.worker, score, factors: entry.factors,
    rationale: pick.ai_rationale, key_strengths: pick.key_strengths || [], source: 'ai',
  });
  const fromRules = (entry, lane) => ({
    lane, worker: entry.worker, score: entry.total, factors: entry.factors,
    rationale: entry.rationale, key_strengths: [], source: 'rules',
  });
  const take = (list, item) => { used.add(item.worker.id); list.push(item); };

  const best = [];
  for (const pick of [...aiBest].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))) {
    if (best.length >= sizes.best_match) break;
    const entry = bestById.get(pick.worker_id);
    if (entry && !used.has(entry.worker.id)) take(best, fromAi(pick, entry, 'best_match', pick.score));
  }
  const bestByScore = [...bestPool].sort((a, b) => b.total - a.total);
  for (const entry of bestByScore) {
    if (best.length >= sizes.best_match) break;
    if (!used.has(entry.worker.id)) take(best, fromRules(entry, 'best_match'));
  }

  const fresh = [];
  for (const pick of aiNew) {
    if (fresh.length >= sizes.new_talent) break;
    const entry = newById.get(pick.worker_id);
    if (entry && !used.has(entry.worker.id)) take(fresh, fromAi(pick, entry, 'new_talent', entry.total));
  }
  for (const entry of shortlist) {
    if (fresh.length >= sizes.new_talent) break;
    if (!used.has(entry.worker.id)) take(fresh, fromRules(entry, 'new_talent'));
  }

  // Give empty places to the other lane.
  const total = sizes.best_match + sizes.new_talent;
  for (const entry of shortlist) {
    if (best.length + fresh.length >= total) break;
    if (!used.has(entry.worker.id)) take(fresh, fromRules(entry, 'new_talent'));
  }
  for (const entry of bestByScore) {
    if (best.length + fresh.length >= total) break;
    if (!used.has(entry.worker.id)) take(best, fromRules(entry, 'best_match'));
  }

  return [...best, ...fresh].map((item, index) => ({ ...item, rank: index + 1 }));
}

module.exports = {
  LANE_SIZES,
  NEW_WORKER_MAX_JOBS,
  NEWCOMER_SHORTLIST_SIZE,
  FIT_TIE_BAND,
  SHOWN_WITHOUT_INVITE_LIMIT,
  UNANSWERED_INVITE_LIMIT,
  INVITE_RESPONSE_DAYS,
  LOOKBACK_DAYS,
  MIN_BIO_LENGTH,
  isDeprioritized,
  shortlistNewcomers,
  assembleLanes,
};
