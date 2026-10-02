'use strict';

const request = require('supertest');
const app = require('../src/app');
const appPool = require('../src/db');
const { executeMatchRun, loadLanePools } = require('../src/agents/matchAgent');
const { getJobDetails } = require('../src/agents/tools/getJobDetails');
const { clearCache } = require('../src/agents/cache');
const { createTestPool, migrateTestDatabase, resetTestDatabase } = require('./support/database');
const { authorizationFor, categoryId, createJob, createUser } = require('./support/marketplace');

let testPool;
const originalKey = process.env.GEMINI_API_KEY;

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
  clearCache();
  // No Gemini: runs take the rule-based path, deterministically.
  delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
  process.env.GEMINI_API_KEY = originalKey;
  if (testPool) await testPool.end();
  await appPool.end();
});

let sequence = 0;
async function worker({ name, jobsDone = 0, rating = 0, verified = true, photo = true, bio = 'Plumber for leaks, taps, drains and bathroom fittings.', skill = 'Plumbing', district = 'Colombo' }) {
  sequence += 1;
  const user = await createUser(testPool, { email: `lane-${sequence}@fixly-test.local`, fullName: name, role: 'worker', district, primarySkill: skill });
  await testPool.query('UPDATE users SET is_nic_verified = $1, profile_photo = $2 WHERE id = $3', [verified, photo ? '/uploads/p.jpg' : null, user.id]);
  await testPool.query('UPDATE worker_profiles SET total_jobs_done = $1, avg_rating = $2, bio = $3 WHERE id = $4', [jobsDone, rating, bio, user.worker_profile_id]);
  await testPool.query('INSERT INTO worker_skills (worker_id, category_id, is_primary) VALUES ($1, $2, true)', [user.worker_profile_id, await categoryId(testPool, skill)]);
  return user;
}

async function plumbingJob() {
  const customer = await createUser(testPool, { email: `lane-customer-${sequence}@fixly-test.local`, fullName: 'Lane Customer', role: 'customer' });
  const job = await createJob(testPool, { customerId: customer.id });
  return { customer, job: await getJobDetails(job.id) };
}

describe('new-talent lane eligibility', () => {
  test('only verified, complete, new workers in the job\'s trade who haven\'t been invited are eligible', async () => {
    const eligible = await worker({ name: 'Eligible Newcomer', jobsDone: 2 });
    const unverified = await worker({ name: 'Unverified', verified: false });
    const noPhoto = await worker({ name: 'No Photo', photo: false });
    const thinBio = await worker({ name: 'Thin Bio', bio: 'Plumber' });
    const otherTrade = await worker({ name: 'Painter', skill: 'Painting' });
    const proven = await worker({ name: 'Proven', jobsDone: 3, rating: 4.9 });
    const invited = await worker({ name: 'Already Invited' });
    const { customer, job } = await plumbingJob();
    await testPool.query('INSERT INTO invites (job_id, customer_id, worker_id) VALUES ($1, $2, $3)', [job.id, customer.id, invited.id]);

    const pools = await loadLanePools(job);

    expect(pools.newcomers.map(w => w.id)).toEqual([eligible.id]);
    expect(pools.bestPool.map(e => e.worker.id)).toEqual([proven.id]);
    for (const excluded of [unverified, noPhoto, thinBio, otherTrade]) {
      expect(pools.bestPool.map(e => e.worker.id)).not.toContain(excluded.id);
    }
  });
});

describe('match run with lanes', () => {
  test('fills 3 best matches and 2 labelled new workers even when Gemini is unavailable', async () => {
    for (let i = 0; i < 4; i += 1) await worker({ name: `Proven ${i}`, jobsDone: 10 + i, rating: 4.5 });
    const newcomers = [];
    for (let i = 0; i < 3; i += 1) newcomers.push(await worker({ name: `Newcomer ${i}` }));
    const { customer, job } = await plumbingJob();
    const run = (await testPool.query(
      "INSERT INTO agent_runs (user_id, agent_type, status, job_id, objective) VALUES ($1, 'match', 'running', $2, 'test') RETURNING id, user_id, job_id",
      [customer.id, job.id],
    )).rows[0];

    await executeMatchRun(run);

    const detail = await request(app).get(`/api/agent/run/${run.id}`).set('Authorization', authorizationFor(customer)).expect(200);
    expect(detail.body.status).toBe('awaiting_confirmation');
    expect(detail.body.engine).toBe('degraded');
    expect(detail.body.recommendations.map(r => r.lane)).toEqual(['best_match', 'best_match', 'best_match', 'new_talent', 'new_talent']);
    expect(detail.body.recommendations.slice(3).every(r => newcomers.some(n => n.id === r.worker.id))).toBe(true);
  });

  test('rotates new workers between runs so the same two aren\'t always shown', async () => {
    for (let i = 0; i < 3; i += 1) await worker({ name: `Proven ${i}`, jobsDone: 10, rating: 4.5 });
    for (let i = 0; i < 4; i += 1) await worker({ name: `Newcomer ${i}` });
    const { customer, job } = await plumbingJob();

    const shown = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const run = (await testPool.query(
        "INSERT INTO agent_runs (user_id, agent_type, status, job_id, objective) VALUES ($1, 'match', 'running', $2, 'test') RETURNING id, user_id, job_id",
        [customer.id, job.id],
      )).rows[0];
      await executeMatchRun(run);
      shown.push((await testPool.query("SELECT entity_id FROM agent_recommendations WHERE run_id = $1 AND lane = 'new_talent' ORDER BY rank LIMIT 2", [run.id])).rows.map(r => r.entity_id));
      // The customer runs the agent again, which replaces these results.
      await testPool.query("UPDATE agent_runs SET status = 'cancelled' WHERE id = $1", [run.id]);
    }
    expect(shown[1].filter(id => shown[0].includes(id))).toEqual([]);
  });
});

describe('agent runs on a serverless host', () => {
  test('a queued run is processed without the background loop, starting from the status poll', async () => {
    for (let i = 0; i < 3; i += 1) await worker({ name: `Serverless proven ${i}`, jobsDone: 10, rating: 4.5 });
    await worker({ name: 'Serverless newcomer' });
    const { customer, job } = await plumbingJob();
    const run = (await testPool.query(
      "INSERT INTO agent_runs (user_id, agent_type, status, job_id, objective) VALUES ($1, 'match', 'pending', $2, 'test') RETURNING id",
      [customer.id, job.id],
    )).rows[0];

    process.env.VERCEL = '1';
    try {
      const first = await request(app).get(`/api/agent/run/${run.id}`).set('Authorization', authorizationFor(customer)).expect(200);
      expect(first.body.status).toBe('pending');
      await vi.waitFor(async () => {
        const status = (await testPool.query('SELECT status FROM agent_runs WHERE id = $1', [run.id])).rows[0].status;
        expect(status).toBe('awaiting_confirmation');
      }, { timeout: 10000, interval: 100 });
    } finally {
      delete process.env.VERCEL;
    }
    const done = await request(app).get(`/api/agent/run/${run.id}`).set('Authorization', authorizationFor(customer)).expect(200);
    expect(done.body.recommendations.map(r => r.lane)).toEqual(['best_match', 'best_match', 'best_match', 'new_talent']);
  });
});
