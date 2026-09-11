'use strict';

const { createMatchRun } = require('../src/agents/matchAgent');
const repository = require('../src/modules/agents/repository');
const { tick } = require('../src/agents/worker');
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
  // Force the deterministic fallback regardless of what's in the local
  // environment, so this test is hermetic and doesn't make a real network
  // call to Gemini.
  originalGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
});

describe('agent worker', () => {
  test('a created run starts pending and tick() executes it to a terminal state', async () => {
    const customer = await createUser(testPool, { email: 'worker-test-customer@fixly-test.local', fullName: 'Customer', role: 'customer' });
    await createUser(testPool, { email: 'worker-test-worker@fixly-test.local', fullName: 'Worker', role: 'worker', primarySkill: 'Plumbing' });
    const job = await createJob(testPool, { customerId: customer.id });

    const created = await createMatchRun(job.id, customer.id);
    expect(created.status).toBe('pending');

    const pendingRow = await testPool.query('SELECT status, claimed_at FROM agent_runs WHERE id = $1', [created.run_id]);
    expect(pendingRow.rows[0].status).toBe('pending');
    expect(pendingRow.rows[0].claimed_at).toBeNull();

    await tick();
    // executeMatchRun runs fire-and-forget inside tick(); give it a moment
    // to finish against the local test DB.
    await new Promise(resolve => setTimeout(resolve, 500));

    const finalRow = await testPool.query('SELECT status, engine, overall_reasoning FROM agent_runs WHERE id = $1', [created.run_id]);
    expect(finalRow.rows[0].status).toBe('awaiting_confirmation');
    expect(finalRow.rows[0].engine).toBe('deterministic');
    expect(finalRow.rows[0].overall_reasoning).toBeTruthy();

    const recs = await testPool.query('SELECT key_strengths FROM agent_recommendations WHERE run_id = $1', [created.run_id]);
    expect(recs.rows.length).toBeGreaterThan(0);
    expect(Array.isArray(recs.rows[0].key_strengths)).toBe(true);
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
