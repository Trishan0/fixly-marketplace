'use strict';

const request = require('supertest');
const app = require('../src/app');
const identityRepository = require('../src/modules/identity/repository');
const agentsRepository = require('../src/modules/agents/repository');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const { authorizationFor, createUser } = require('./support/marketplace');

let testPool;

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

afterAll(async () => {
  await testPool.end();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
});

describe('worker AI matching opt-in', () => {
  test('a new worker defaults to included in the Match Agent candidate pool', async () => {
    const worker = await createUser(testPool, {
      email: 'ai-opt-default@fixly-test.local', fullName: 'Default Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    const pool = await agentsRepository.candidateWorkers(null, 100);
    expect(pool.map(w => w.id)).toContain(worker.id);
  });

  test('opting out excludes the worker from the candidate pool', async () => {
    const worker = await createUser(testPool, {
      email: 'ai-opt-out@fixly-test.local', fullName: 'Opted Out Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    await identityRepository.setAiMatchingOptIn(worker.id, false);

    const pool = await agentsRepository.candidateWorkers(null, 100);
    expect(pool.map(w => w.id)).not.toContain(worker.id);
  });

  test('opting back in restores them to the candidate pool', async () => {
    const worker = await createUser(testPool, {
      email: 'ai-opt-back-in@fixly-test.local', fullName: 'Back In Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    await identityRepository.setAiMatchingOptIn(worker.id, false);
    await identityRepository.setAiMatchingOptIn(worker.id, true);

    const pool = await agentsRepository.candidateWorkers(null, 100);
    expect(pool.map(w => w.id)).toContain(worker.id);
  });

  test('PUT /profile/ai-matching-opt-in rejects a non-boolean body', async () => {
    const worker = await createUser(testPool, {
      email: 'ai-opt-bad-body@fixly-test.local', fullName: 'Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    await request(app)
      .put('/api/profile/ai-matching-opt-in')
      .set('Authorization', authorizationFor(worker))
      .send({ opt_in: 'yes' })
      .expect(400);
  });

  test('PUT /profile/ai-matching-opt-in rejects a non-worker caller', async () => {
    const customer = await createUser(testPool, {
      email: 'ai-opt-customer@fixly-test.local', fullName: 'Customer', role: 'customer',
    });

    await request(app)
      .put('/api/profile/ai-matching-opt-in')
      .set('Authorization', authorizationFor(customer))
      .send({ opt_in: false })
      .expect(403);
  });

  test('PUT /profile/ai-matching-opt-in updates the flag for the authenticated worker', async () => {
    const worker = await createUser(testPool, {
      email: 'ai-opt-route-success@fixly-test.local', fullName: 'Worker', role: 'worker', primarySkill: 'Plumbing',
    });

    const response = await request(app)
      .put('/api/profile/ai-matching-opt-in')
      .set('Authorization', authorizationFor(worker))
      .send({ opt_in: false })
      .expect(200);

    expect(response.body.ai_matching_opt_in).toBe(false);

    const pool = await agentsRepository.candidateWorkers(null, 100);
    expect(pool.map(w => w.id)).not.toContain(worker.id);
  });
});
