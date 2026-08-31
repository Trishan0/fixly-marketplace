'use strict';

const request = require('supertest');
const app = require('../src/app');
const { runProposalAgent } = require('../src/agents/proposalAgent');
const marketplaceRepository = require('../src/modules/marketplace/repository');
const {
  acceptInvitation,
  confirmMatchAgent,
  confirmProposalAgent,
  createInvitation,
} = require('../src/modules/marketplace/service');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const {
  authorizationFor,
  createJob,
  createUser,
} = require('./support/marketplace');

let testPool;

async function awaitingRun({ userId, agentType, jobId = null }) {
  const result = await testPool.query(
    `INSERT INTO agent_runs (user_id, agent_type, status, job_id)
     VALUES ($1, $2, 'awaiting_confirmation', $3) RETURNING id`,
    [userId, agentType, jobId]
  );
  return result.rows[0];
}

async function recommend(runId, entityType, entityId) {
  await testPool.query(
    `INSERT INTO agent_recommendations (run_id, entity_type, entity_id, score, rank)
     VALUES ($1, $2, $3, 0.9000, 1)`,
    [runId, entityType, entityId]
  );
}

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
});

afterAll(async () => {
  if (testPool) {
    await resetTestDatabase(testPool);
    await testPool.end();
  }
});

describe('Phase 5 invitations and agent confirmation invariants', () => {
  test('serializes duplicate invitation acceptance and creates exactly one proposal', async () => {
    const customer = await createUser(testPool, { email: 'invite-race-customer@fixly-test.local', fullName: 'Invite Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'invite-race-worker@fixly-test.local', fullName: 'Invite Worker', role: 'worker' });
    const job = await createJob(testPool, { customerId: customer.id });
    const { invite } = await createInvitation({ jobId: job.id, customerId: customer.id, input: { worker_id: worker.id } });
    const workerAuth = authorizationFor(worker);

    const responses = await Promise.all([
      request(app).put(`/api/invites/${invite.id}/accept`).set('Authorization', workerAuth),
      request(app).put(`/api/invites/${invite.id}/accept`).set('Authorization', workerAuth),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 200]);

    const [inviteState, proposals, jobState] = await Promise.all([
      testPool.query('SELECT status FROM invites WHERE id = $1', [invite.id]),
      testPool.query('SELECT COUNT(*)::int AS count FROM proposals WHERE job_id = $1 AND worker_id = $2', [job.id, worker.id]),
      testPool.query('SELECT status FROM jobs WHERE id = $1', [job.id]),
    ]);
    expect(inviteState.rows[0].status).toBe('accepted');
    expect(proposals.rows[0].count).toBe(1);
    expect(jobState.rows[0].status).toBe('proposals_received');
  });

  test('rolls back invitation acceptance when its notification cannot be written', async () => {
    const customer = await createUser(testPool, { email: 'invite-rollback-customer@fixly-test.local', fullName: 'Rollback Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'invite-rollback-worker@fixly-test.local', fullName: 'Rollback Worker', role: 'worker' });
    const job = await createJob(testPool, { customerId: customer.id });
    const { invite } = await createInvitation({ jobId: job.id, customerId: customer.id, input: { worker_id: worker.id } });
    const original = marketplaceRepository.insertNotification;
    marketplaceRepository.insertNotification = async () => { throw new Error('injected notification failure'); };

    try {
      await expect(acceptInvitation({ inviteId: invite.id, worker })).rejects.toThrow('injected notification failure');
    } finally {
      marketplaceRepository.insertNotification = original;
    }

    const [inviteState, proposals, jobState] = await Promise.all([
      testPool.query('SELECT status FROM invites WHERE id = $1', [invite.id]),
      testPool.query('SELECT COUNT(*)::int AS count FROM proposals WHERE job_id = $1', [job.id]),
      testPool.query('SELECT status FROM jobs WHERE id = $1', [job.id]),
    ]);
    expect(inviteState.rows[0].status).toBe('pending');
    expect(proposals.rows[0].count).toBe(0);
    expect(jobState.rows[0].status).toBe('posted');
  });

  test('binds agent confirmation selections to stored recommendations before writes', async () => {
    const customer = await createUser(testPool, { email: 'match-confirm-customer@fixly-test.local', fullName: 'Match Customer', role: 'customer' });
    const recommendedWorker = await createUser(testPool, { email: 'match-confirm-recommended@fixly-test.local', fullName: 'Recommended Worker', role: 'worker' });
    const otherWorker = await createUser(testPool, { email: 'match-confirm-other@fixly-test.local', fullName: 'Other Worker', role: 'worker' });
    const job = await createJob(testPool, { customerId: customer.id });
    const run = await awaitingRun({ userId: customer.id, agentType: 'match', jobId: job.id });
    await recommend(run.id, 'worker', recommendedWorker.id);

    await expect(confirmMatchAgent({
      runId: run.id,
      customerId: customer.id,
      selections: [recommendedWorker.id, otherWorker.id],
    })).rejects.toMatchObject({ status: 400 });

    const [invitesAfterFailure, runAfterFailure] = await Promise.all([
      testPool.query('SELECT COUNT(*)::int AS count FROM invites WHERE job_id = $1', [job.id]),
      testPool.query('SELECT status FROM agent_runs WHERE id = $1', [run.id]),
    ]);
    expect(invitesAfterFailure.rows[0].count).toBe(0);
    expect(runAfterFailure.rows[0].status).toBe('awaiting_confirmation');

    const result = await confirmMatchAgent({ runId: run.id, customerId: customer.id, selections: [recommendedWorker.id] });
    expect(result.results).toMatchObject([{ workerId: recommendedWorker.id, status: 'invited' }]);
    const recommendation = await testPool.query('SELECT action_taken FROM agent_recommendations WHERE run_id = $1', [run.id]);
    expect(recommendation.rows[0].action_taken).toBe('invited');
  });

  test('enforces active-run and recommendation uniqueness at the database boundary', async () => {
    const customer = await createUser(testPool, { email: 'agent-index-customer@fixly-test.local', fullName: 'Index Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'agent-index-worker@fixly-test.local', fullName: 'Index Worker', role: 'worker' });
    const job = await createJob(testPool, { customerId: customer.id });
    const matchRun = await awaitingRun({ userId: customer.id, agentType: 'match', jobId: job.id });
    await recommend(matchRun.id, 'worker', worker.id);

    await expect(testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status, job_id)
       VALUES ($1, 'match', 'running', $2)`,
      [customer.id, job.id]
    )).rejects.toMatchObject({ code: '23505' });
    await expect(recommend(matchRun.id, 'worker', worker.id)).rejects.toMatchObject({ code: '23505' });

    const proposalRun = await awaitingRun({ userId: worker.id, agentType: 'proposal' });
    await expect(testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status)
       VALUES ($1, 'proposal', 'pending')`,
      [worker.id]
    )).rejects.toMatchObject({ code: '23505' });

    const proposalJob = await createJob(testPool, { customerId: customer.id, title: 'Agent proposal target' });
    await recommend(proposalRun.id, 'job', proposalJob.id);
    const proposalResult = await confirmProposalAgent({
      runId: proposalRun.id,
      worker,
      selections: [{ job_id: proposalJob.id, message: 'I can help tomorrow.', proposed_price: '2500.00' }],
    });
    expect(proposalResult.results).toMatchObject([{ job_id: proposalJob.id, status: 'submitted' }]);
  });

  test('leaves one terminal outcome when confirmation races cancellation', async () => {
    const customer = await createUser(testPool, { email: 'confirm-cancel-customer@fixly-test.local', fullName: 'Race Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'confirm-cancel-worker@fixly-test.local', fullName: 'Race Worker', role: 'worker' });
    const job = await createJob(testPool, { customerId: customer.id });
    const run = await awaitingRun({ userId: customer.id, agentType: 'match', jobId: job.id });
    await recommend(run.id, 'worker', worker.id);
    const auth = authorizationFor(customer);

    const [confirmResponse, cancelResponse] = await Promise.all([
      request(app).post(`/api/agent/run/${run.id}/confirm`).set('Authorization', auth)
        .send({ action_type: 'invite', selections: [worker.id] }),
      request(app).post(`/api/agent/run/${run.id}/cancel`).set('Authorization', auth),
    ]);

    expect([confirmResponse.status, cancelResponse.status].filter(status => status === 200)).toHaveLength(1);
    expect([confirmResponse.status, cancelResponse.status].every(status => [200, 404, 409].includes(status))).toBe(true);
    const [runState, invites] = await Promise.all([
      testPool.query('SELECT status FROM agent_runs WHERE id = $1', [run.id]),
      testPool.query('SELECT COUNT(*)::int AS count FROM invites WHERE job_id = $1', [job.id]),
    ]);
    expect(['completed', 'cancelled']).toContain(runState.rows[0].status);
    expect(invites.rows[0].count).toBe(runState.rows[0].status === 'completed' ? 1 : 0);
  });

  test('marks a failed agent run as terminal instead of leaving it active', async () => {
    const customer = await createUser(testPool, { email: 'agent-failure-customer@fixly-test.local', fullName: 'No Worker Profile', role: 'customer' });

    await expect(runProposalAgent(customer.id)).rejects.toThrow('Worker profile not found');

    const run = await testPool.query(
      "SELECT status FROM agent_runs WHERE user_id = $1 AND agent_type = 'proposal'",
      [customer.id]
    );
    expect(run.rows).toEqual([{ status: 'error' }]);
  });
});
