'use strict';

const { createMatchRun } = require('../src/agents/matchAgent');
const repository = require('../src/modules/agents/repository');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const { createJob, createUser } = require('./support/marketplace');

let testPool;
let originalGeminiKey;

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

afterAll(async () => {
  await testPool.end();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
  originalGeminiKey = process.env.GEMINI_API_KEY;
});

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
});

// Actually executing a run end-to-end requires a real Gemini call - there's
// no deterministic fallback left to exercise here hermetically. That path
// is covered by the opt-in agents-eval.integration.test.js instead; this
// file sticks to what's verifiable without a network call: the fast-fail
// behavior when Gemini isn't configured, and the worker's claim/reclaim
// mechanics (hand-inserted rows, no agent execution needed).
describe('agent worker', () => {
  test('createMatchRun fails fast, before creating a row, when Gemini is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    const customer = await createUser(testPool, { email: 'worker-test-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const job = await createJob(testPool, { customerId: customer.id });

    await expect(createMatchRun(job.id, customer.id)).rejects.toThrow('AI matching is currently unavailable');

    const rows = await testPool.query('SELECT id FROM agent_runs WHERE job_id = $1', [job.id]);
    expect(rows.rows).toHaveLength(0);
  });

  test('a run stuck in running past the stale window is reclaimed to pending', async () => {
    const customer = await createUser(testPool, { email: 'worker-test-stale-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const job = await createJob(testPool, { customerId: customer.id });

    const stuck = await testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status, job_id, claimed_at)
       VALUES ($1, 'match', 'running', $2, NOW() - INTERVAL '10 minutes') RETURNING id`,
      [customer.id, job.id]
    );

    await repository.reclaimOrphanedRuns(5);

    const reclaimed = await testPool.query('SELECT status, claimed_at FROM agent_runs WHERE id = $1', [stuck.rows[0].id]);
    expect(reclaimed.rows[0].status).toBe('pending');
    expect(reclaimed.rows[0].claimed_at).toBeNull();
  });

  test('a run claimed within the stale window is left alone', async () => {
    const customer = await createUser(testPool, { email: 'worker-test-fresh-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    const job = await createJob(testPool, { customerId: customer.id });

    const fresh = await testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status, job_id, claimed_at)
       VALUES ($1, 'match', 'running', $2, NOW()) RETURNING id`,
      [customer.id, job.id]
    );

    await repository.reclaimOrphanedRuns(5);

    const untouched = await testPool.query('SELECT status FROM agent_runs WHERE id = $1', [fresh.rows[0].id]);
    expect(untouched.rows[0].status).toBe('running');
  });
});
