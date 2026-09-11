'use strict';

// Property-based regression check for the Match Agent's qualitative
// ranking. Exact-score assertions would be brittle against a non-
// deterministic model, so this checks properties the ranking must hold
// regardless of exact wording: a worker with a planted pattern of "no-show"
// complaints must never outscore an otherwise-comparable worker with
// planted strong, relevant praise, and every recommendation must reference
// a worker that was actually in the candidate pool.
//
// This makes a real Gemini call and costs real API quota, so it only runs
// when BOTH GEMINI_API_KEY is configured AND RUN_AGENT_EVAL=true is set
// explicitly - it deliberately does NOT fire just because a key happens to
// be present in the environment, so a routine `npm run test:integration`
// never silently makes paid network calls. Run it on purpose with:
//   RUN_AGENT_EVAL=true npm run test:integration -- agents-eval

const { createMatchRun, executeMatchRun } = require('../src/agents/matchAgent');
const repository = require('../src/modules/agents/repository');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const { createJob, createReview, createUser } = require('./support/marketplace');

const shouldRun = Boolean(process.env.GEMINI_API_KEY) && process.env.RUN_AGENT_EVAL === 'true';

let testPool;

beforeAll(async () => {
  if (!shouldRun) return; // avoid connecting a DB pool at all when this suite is skipped
  await migrateTestDatabase();
  testPool = createTestPool();
});

afterAll(async () => {
  if (testPool) await testPool.end();
});

beforeEach(async () => {
  if (testPool) await resetTestDatabase(testPool);
});

const NO_SHOW_FEEDBACK = [
  'Never showed up on the scheduled day, had to reschedule twice.',
  'Was a no-show and did not answer any calls.',
  'Arrived three hours late without any notice.',
  'Cancelled last minute, very unprofessional.',
  'Missed the appointment entirely and wasted my whole day.',
];

const PRAISE_FEEDBACK = [
  'Outstanding plumber, fixed the leaking pipe perfectly and was very punctual.',
  'Extremely professional, explained everything clearly, and left the site spotless.',
  'Best plumber I have hired, solved a leak two other workers could not fix.',
  'On time, tidy, and the repair has held up perfectly for months.',
  'Highly skilled and courteous plumber, will definitely hire again.',
];

async function plantReviews(pool, { customerId, workerId, feedbackList, rating }) {
  for (const feedback of feedbackList) {
    // Status doesn't matter here - reviews only need a valid job row to
    // join against for title/category; the "assigned_worker_id required
    // when completed" constraint means 'posted' is the simplest fit.
    const job = await createJob(pool, {
      customerId,
      title: 'Fix a bathroom leak',
      description: 'Recurring small leak under the bathroom sink.',
    });
    await createReview(pool, { jobId: job.id, customerId, workerId, rating, feedback });
  }
}

describe.skipIf(!shouldRun)('agent qualitative ranking eval (live Gemini)', () => {
  test('a worker with planted no-show reviews never outscores one with planted strong, relevant praise', async () => {
    const customer = await createUser(testPool, { email: 'eval-customer@fixly-test.local', fullName: 'Eval Customer', role: 'customer' });

    const noShowWorker = await createUser(testPool, {
      email: 'eval-noshow-worker@fixly-test.local', fullName: 'No Show Worker', role: 'worker', primarySkill: 'Plumbing',
    });
    const praiseWorker = await createUser(testPool, {
      email: 'eval-praise-worker@fixly-test.local', fullName: 'Praise Worker', role: 'worker', primarySkill: 'Plumbing',
    });
    const newWorker = await createUser(testPool, {
      email: 'eval-new-worker@fixly-test.local', fullName: 'New Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    // Same objective footing (rating, job count) for all three so any
    // ranking difference the LLM produces is attributable to what it read
    // in the reviews/bio, not to the formula's own inputs.
    await testPool.query(
      `UPDATE worker_profiles SET avg_rating = 4.2, total_jobs_done = 8 WHERE user_id IN ($1, $2)`,
      [noShowWorker.id, praiseWorker.id]
    );

    await plantReviews(testPool, { customerId: customer.id, workerId: noShowWorker.id, feedbackList: NO_SHOW_FEEDBACK, rating: 3 });
    await plantReviews(testPool, { customerId: customer.id, workerId: praiseWorker.id, feedbackList: PRAISE_FEEDBACK, rating: 5 });
    // newWorker gets no reviews at all - not asserted on directly here, just
    // present so the pool isn't trivially two workers.

    const job = await createJob(testPool, {
      customerId: customer.id,
      title: 'Fix a leaking kitchen pipe',
      description: 'Water is leaking steadily under the kitchen sink and needs a reliable, punctual plumber.',
    });

    const created = await createMatchRun(job.id, customer.id);
    // Go through the real claim transition (pending -> running) rather than
    // handing executeMatchRun a still-'pending' row - awaitConfirmation's
    // own UPDATE is guarded on status='running' and would silently no-op
    // otherwise, exactly like the real worker.js path.
    const claimed = await repository.claimPendingRun();
    await executeMatchRun(claimed);

    const finalRun = await testPool.query('SELECT status, engine FROM agent_runs WHERE id = $1', [created.run_id]);
    expect(finalRun.rows[0].status).toBe('awaiting_confirmation');
    expect(finalRun.rows[0].engine).toBe('gemini');

    const recs = await testPool.query(
      'SELECT entity_id, score, rank FROM agent_recommendations WHERE run_id = $1',
      [created.run_id]
    );
    expect(recs.rows.length).toBeGreaterThan(0);

    const knownWorkerIds = new Set([noShowWorker.id, praiseWorker.id, newWorker.id]);
    for (const rec of recs.rows) {
      expect(knownWorkerIds.has(rec.entity_id)).toBe(true);
    }

    const noShowRec = recs.rows.find(r => r.entity_id === noShowWorker.id);
    const praiseRec = recs.rows.find(r => r.entity_id === praiseWorker.id);
    // Both should have been surfaced (the pool is tiny), but the core
    // property under test only applies when both were actually recommended.
    if (noShowRec && praiseRec) {
      expect(Number(noShowRec.score)).toBeLessThan(Number(praiseRec.score));
    }
  // Observed live latency in this environment: each generateContent round
  // trip can take 45-60s, and a full run needs several rounds (job details
  // + memory, candidate shortlist, batched review reads, final synthesis).
  // Generous on purpose - this suite is opt-in only and never runs in CI.
  }, 300_000);
});
