'use strict';

const { scoreAllWorkersForJob } = require('../src/agents/scoring');

function worker(overrides = {}) {
  return {
    id: 'w', full_name: 'Worker', district: 'Colombo', primary_skill: 'Plumbing',
    avg_rating: 4.5, total_jobs_done: 10, starting_price: '2000', is_nic_verified: true,
    skills: [],
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    id: 'j', category_name: 'Plumbing', district: 'Colombo', urgency: 'flexible',
    fixed_budget: 2000,
    ...overrides,
  };
}

describe('scoreAllWorkersForJob', () => {
  test('scores every candidate without excluding or reordering any of them', () => {
    const strong = worker({ id: 'strong', district: 'Colombo', avg_rating: 5, total_jobs_done: 20 });
    const weak = worker({ id: 'weak', district: 'Kandy', avg_rating: 0, total_jobs_done: 0 });

    const result = scoreAllWorkersForJob([weak, strong], job());

    // Input order is preserved - no sort, no cut. It's the agent's job to
    // decide who's worth a closer look, not this function's.
    expect(result.map(r => r.worker.id)).toEqual(['weak', 'strong']);
    expect(result).toHaveLength(2);
  });

  test('does not cap the result at any size, however large the pool', () => {
    const workers = Array.from({ length: 200 }, (_, i) => worker({ id: `w${i}` }));

    const result = scoreAllWorkersForJob(workers, job());

    expect(result).toHaveLength(200);
  });

  test('handles an empty candidate list', () => {
    expect(scoreAllWorkersForJob([], job())).toEqual([]);
  });

  test('each entry carries the worker, its total score, factors, and rationale', () => {
    const result = scoreAllWorkersForJob([worker()], job());

    expect(result[0]).toMatchObject({
      worker: expect.objectContaining({ id: 'w' }),
      total: expect.any(Number),
      factors: expect.any(Object),
      rationale: expect.any(String),
    });
  });
});
