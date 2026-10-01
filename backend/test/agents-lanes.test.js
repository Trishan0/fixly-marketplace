'use strict';

const { assembleLanes, shortlistNewcomers, isDeprioritized, SHOWN_WITHOUT_INVITE_LIMIT } = require('../src/agents/lanes');
const { scoreWorkerForJob, scoreNewcomerForJob, priceNote } = require('../src/agents/scoring');

const job = { id: 'job', category_id: 'plumbing', category_name: 'Plumbing', district: 'Colombo', urgency: 'today', pricing_mode: 'fixed', fixed_budget: '5000' };

function entry(id, total, extra = {}) {
  return { worker: { id, ...extra }, total, factors: {}, rationale: `rules ${id}` };
}

function newcomer(id, overrides = {}) {
  return {
    id, district: 'Colombo', bio: 'Plumber who fixes leaks, taps and bathroom fittings.', portfolio_count: 3,
    skills: [{ category_id: 'plumbing', is_primary: true }], total_jobs_done: 0,
    shown_since_reset: 0, invites_accepted: 0, invites_unanswered: 0, last_shown_at: null, ...overrides,
  };
}

describe('assembleLanes', () => {
  const bestPool = [entry('b1', 0.9), entry('b2', 0.8), entry('b3', 0.7), entry('b4', 0.6)];
  const shortlist = [entry('n1', 0.8), entry('n2', 0.7), entry('n3', 0.6)];

  test('fills 3 best matches and 2 new workers, best matches first', () => {
    const result = assembleLanes({ bestPool, shortlist });
    expect(result.map(r => [r.worker.id, r.lane, r.rank])).toEqual([
      ['b1', 'best_match', 1], ['b2', 'best_match', 2], ['b3', 'best_match', 3],
      ['n1', 'new_talent', 4], ['n2', 'new_talent', 5],
    ]);
  });

  test('uses the model\'s picks and ignores any worker outside the allowed lists', () => {
    const result = assembleLanes({
      bestPool, shortlist,
      aiBest: [
        { worker_id: 'b3', rank: 1, score: 0.95, ai_rationale: 'Read the reviews' },
        { worker_id: 'n1', rank: 2, score: 0.9, ai_rationale: 'Newcomer smuggled into best matches' },
        { worker_id: 'ghost', rank: 3, score: 0.9, ai_rationale: 'Hallucinated' },
      ],
      aiNew: [{ worker_id: 'n3', ai_rationale: 'Bio fits' }, { worker_id: 'b1', ai_rationale: 'Proven worker smuggled into new' }],
    });
    expect(result.map(r => [r.worker.id, r.lane, r.source])).toEqual([
      ['b3', 'best_match', 'ai'], ['b1', 'best_match', 'rules'], ['b2', 'best_match', 'rules'],
      ['n3', 'new_talent', 'ai'], ['n1', 'new_talent', 'rules'],
    ]);
    expect(result[0].score).toBe(0.95);
    // A newcomer's score always comes from code, never the model.
    expect(result[3].score).toBe(0.6);
  });

  test('gives empty places to the other lane but keeps true lane labels', () => {
    const fewProven = assembleLanes({ bestPool: [entry('b1', 0.9)], shortlist });
    expect(fewProven.map(r => [r.worker.id, r.lane])).toEqual([
      ['b1', 'best_match'], ['n1', 'new_talent'], ['n2', 'new_talent'], ['n3', 'new_talent'],
    ]);

    const noNewcomers = assembleLanes({ bestPool, shortlist: [] });
    expect(noNewcomers.map(r => r.worker.id)).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(noNewcomers.every(r => r.lane === 'best_match')).toBe(true);
  });

  test('never shows anyone twice', () => {
    const result = assembleLanes({ bestPool, shortlist, aiBest: [{ worker_id: 'b1', rank: 1, score: 0.9, ai_rationale: 'x' }, { worker_id: 'b1', rank: 2, score: 0.9, ai_rationale: 'x' }] });
    expect(new Set(result.map(r => r.worker.id)).size).toBe(result.length);
  });
});

describe('shortlistNewcomers', () => {
  test('rotates equally good newcomers: least recently shown first, never shown before all', () => {
    const recent = newcomer('recent', { last_shown_at: '2026-09-30T10:00:00Z' });
    const older = newcomer('older', { last_shown_at: '2026-09-01T10:00:00Z' });
    const never = newcomer('never');
    expect(shortlistNewcomers([recent, older, never], job).map(s => s.worker.id)).toEqual(['never', 'older', 'recent']);
  });

  test('a clearly better fit beats rotation', () => {
    const strong = newcomer('strong', { last_shown_at: '2026-09-30T10:00:00Z' });
    const otherTrade = newcomer('other', { skills: [{ category_id: 'painting', is_primary: true }], primary_skill: 'Painting' });
    expect(shortlistNewcomers([otherTrade, strong], job)[0].worker.id).toBe('strong');
  });

  test('moves passed-over or unresponsive newcomers to the back, without removing them', () => {
    const passedOver = newcomer('passed', { shown_since_reset: SHOWN_WITHOUT_INVITE_LIMIT });
    const unresponsive = newcomer('silent', { invites_unanswered: 3 });
    const weakerButFresh = newcomer('fresh', { portfolio_count: 0, bio: 'Plumber, available most days of the week.' });
    expect(isDeprioritized(passedOver)).toBe(true);
    expect(isDeprioritized(unresponsive)).toBe(true);
    expect(isDeprioritized(newcomer('answered', { invites_unanswered: 3, invites_accepted: 1 }))).toBe(false);
    expect(shortlistNewcomers([passedOver, unresponsive, weakerButFresh], job).map(s => s.worker.id)).toEqual(['fresh', 'passed', 'silent']);
  });
});

describe('fairer match scoring', () => {
  const veteran = { district: 'Colombo', primary_skill: 'Plumbing', avg_rating: 4.8, total_jobs_done: 40, review_count: 30, is_nic_verified: true, starting_price: '99999' };
  const unrated = { ...veteran, avg_rating: 0, total_jobs_done: 0, review_count: 0, starting_price: null };

  test('an unrated worker starts at the platform average, not a fixed low score', () => {
    expect(scoreWorkerForJob(unrated, job, { platformAvgRating: 4.5 }).factors.rating_score).toBeCloseTo(0.9);
  });

  test('price is not a ranking factor', () => {
    const { factors } = scoreWorkerForJob(veteran, job);
    expect(factors).not.toHaveProperty('price_fit');
    expect(scoreWorkerForJob(veteran, job).total).toBe(scoreWorkerForJob({ ...veteran, starting_price: '100' }, job).total);
  });

  test('urgency does not penalize inexperience a second time', () => {
    expect(scoreWorkerForJob(unrated, job).factors.urgency_fit).toBe(scoreWorkerForJob(veteran, job).factors.urgency_fit);
  });

  test('newcomer fit ignores rating and experience', () => {
    const a = scoreNewcomerForJob(newcomer('a'), job);
    const b = scoreNewcomerForJob(newcomer('b', { total_jobs_done: 2, avg_rating: 1 }), job);
    expect(a.total).toBe(b.total);
    expect(a.rationale).toContain('ID verified');
  });
});

describe('priceNote', () => {
  test('notes a guide price well above a fixed budget, and only then', () => {
    expect(priceNote({ starting_price: 'LKR 8,000' }, job)).toBe('Usually starts at LKR 8,000. Your budget is LKR 5,000.');
    expect(priceNote({ starting_price: '7000' }, job)).toBeNull();
    expect(priceNote({ starting_price: null }, job)).toBeNull();
    expect(priceNote({ starting_price: '9000' }, { ...job, pricing_mode: 'ask_quotes' })).toBeNull();
  });
});
