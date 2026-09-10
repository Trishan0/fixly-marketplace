'use strict';

const { shortlistWorkersForJob } = require('../src/agents/scoring');

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

describe('shortlistWorkersForJob', () => {
  test('sorts candidates by score, descending', () => {
    const strong = worker({ id: 'strong', district: 'Colombo', avg_rating: 5, total_jobs_done: 20 });
    const weak = worker({ id: 'weak', district: 'Kandy', avg_rating: 0, total_jobs_done: 0 });

    const result = shortlistWorkersForJob([weak, strong], job(), 10);

    expect(result.map(r => r.worker.id)).toEqual(['strong', 'weak']);
    expect(result[0].total).toBeGreaterThan(result[1].total);
  });

  test('caps the result at the given limit', () => {
    const workers = Array.from({ length: 20 }, (_, i) => worker({ id: `w${i}` }));

    const result = shortlistWorkersForJob(workers, job(), 12);

    expect(result).toHaveLength(12);
  });

  test('returns every candidate untouched when fewer than the limit exist', () => {
    const workers = [worker({ id: 'a' }), worker({ id: 'b' })];

    const result = shortlistWorkersForJob(workers, job(), 12);

    expect(result).toHaveLength(2);
  });

  test('handles an empty candidate list', () => {
    expect(shortlistWorkersForJob([], job(), 12)).toEqual([]);
  });

  test('each entry carries the worker, its total score, factors, and rationale', () => {
    const result = shortlistWorkersForJob([worker()], job(), 12);

    expect(result[0]).toMatchObject({
      worker: expect.objectContaining({ id: 'w' }),
      total: expect.any(Number),
      factors: expect.any(Object),
      rationale: expect.any(String),
    });
  });
});
