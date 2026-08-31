'use strict';

const request = require('supertest');
const app = require('../src/app');
const appPool = require('../src/db');
const marketplaceRepository = require('../src/modules/marketplace/repository');
const { acceptProposal: acceptProposalService } = require('../src/modules/marketplace/service');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const {
  authorizationFor,
  categoryId,
  createJob,
  createProposal,
  createUser,
} = require('./support/marketplace');

let testPool;

beforeAll(async () => {
  await migrateTestDatabase();
  testPool = createTestPool();
});

beforeEach(async () => {
  await resetTestDatabase(testPool);
});

afterAll(async () => {
  if (testPool) await testPool.end();
  await appPool.end();
});

describe('marketplace workflow characterization', () => {
  test('runs the customer job, proposal, assignment, payment, and review flow', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-workflow@fixly-test.local',
      fullName: 'Workflow Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-workflow@fixly-test.local',
      fullName: 'Workflow Worker',
      role: 'worker',
      primarySkill: 'Plumbing',
    });
    const plumbingId = await categoryId(testPool);
    const customerAuth = authorizationFor(customer);
    const workerAuth = authorizationFor(worker);

    const jobResponse = await request(app)
      .post('/api/jobs')
      .set('Authorization', customerAuth)
      .send({
        title: 'Workflow leaking pipe',
        description: 'A kitchen pipe needs repair.',
        category_id: plumbingId,
        district: 'Colombo',
        pricing_mode: 'ask_quotes',
      })
      .expect(201);

    const jobId = jobResponse.body.id;
    const proposalResponse = await request(app)
      .post(`/api/jobs/${jobId}/proposals`)
      .set('Authorization', workerAuth)
      .send({ proposed_price: '6000.00', availability: 'Tomorrow', message: 'Available tomorrow.' })
      .expect(201);

    await request(app)
      .put(`/api/proposals/${proposalResponse.body.id}/accept`)
      .set('Authorization', customerAuth)
      .expect(200);

    await request(app)
      .put(`/api/jobs/${jobId}/status`)
      .set('Authorization', workerAuth)
      .send({ status: 'in_progress' })
      .expect(200);

    await request(app)
      .put(`/api/jobs/${jobId}/status`)
      .set('Authorization', workerAuth)
      .send({ status: 'completed' })
      .expect(200);

    const paymentResponse = await request(app)
      .post(`/api/jobs/${jobId}/payment`)
      .set('Authorization', customerAuth)
      .send({ amount: '6000.00', method: 'cash', note: 'Paid after completion.' })
      .expect(201);

    await request(app)
      .put(`/api/payments/${paymentResponse.body.id}/confirm`)
      .set('Authorization', workerAuth)
      .expect(200);

    await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .set('Authorization', customerAuth)
      .send({ rating: 5, feedback: 'Reliable work.' })
      .expect(201);

    const job = await testPool.query(
      'SELECT status, assigned_worker_id, final_price FROM jobs WHERE id = $1',
      [jobId]
    );
    expect(job.rows[0]).toMatchObject({
      status: 'reviewed',
      assigned_worker_id: worker.id,
      final_price: '6000.00',
    });

    const reviewCount = await testPool.query('SELECT COUNT(*)::int AS count FROM reviews WHERE job_id = $1', [jobId]);
    const notificationCount = await testPool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id IN ($1, $2)', [customer.id, worker.id]);
    expect(reviewCount.rows[0].count).toBe(1);
    expect(notificationCount.rows[0].count).toBeGreaterThanOrEqual(5);
  });

  test('rejects an unauthenticated job write, duplicate proposal, and non-owner proposal acceptance', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-ownership@fixly-test.local',
      fullName: 'Ownership Customer',
      role: 'customer',
    });
    const otherCustomer = await createUser(testPool, {
      email: 'other-customer@fixly-test.local',
      fullName: 'Other Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-ownership@fixly-test.local',
      fullName: 'Ownership Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id });
    const proposal = await createProposal(testPool, { jobId: job.id, workerId: worker.id });

    await request(app)
      .post('/api/jobs')
      .send({ title: 'Unauthenticated job', category_id: await categoryId(testPool) })
      .expect(401);

    await request(app)
      .post(`/api/jobs/${job.id}/proposals`)
      .set('Authorization', authorizationFor(worker))
      .send({ proposed_price: '5000.00' })
      .expect(409);

    await request(app)
      .put(`/api/proposals/${proposal.id}/accept`)
      .set('Authorization', authorizationFor(otherCustomer))
      .expect(403);
  });

  test('rejects repeated payment and review attempts once the job has advanced', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-duplicates@fixly-test.local',
      fullName: 'Duplicate Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-duplicates@fixly-test.local',
      fullName: 'Duplicate Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id });
    await testPool.query(
      "UPDATE jobs SET assigned_worker_id = $1, final_price = $2, status = 'completed' WHERE id = $3",
      [worker.id, '7500.00', job.id]
    );
    const customerAuth = authorizationFor(customer);

    await request(app)
      .post(`/api/jobs/${job.id}/payment`)
      .set('Authorization', customerAuth)
      .send({ amount: '7500.00', method: 'cash' })
      .expect(201);

    await request(app)
      .post(`/api/jobs/${job.id}/payment`)
      .set('Authorization', customerAuth)
      .send({ amount: '7500.00', method: 'cash' })
      .expect(400);

    await request(app)
      .post(`/api/jobs/${job.id}/review`)
      .set('Authorization', customerAuth)
      .send({ rating: 4, feedback: 'Completed.' })
      .expect(201);

    await request(app)
      .post(`/api/jobs/${job.id}/review`)
      .set('Authorization', customerAuth)
      .send({ rating: 4, feedback: 'Repeated.' })
      .expect(400);
  });
});

describe('Phase 3 jobs and proposals invariants', () => {
  test('rolls back proposal acceptance if its required notification cannot be inserted', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-accept-rollback@fixly-test.local',
      fullName: 'Rollback Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-accept-rollback@fixly-test.local',
      fullName: 'Rollback Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id, status: 'proposals_received' });
    const proposal = await createProposal(testPool, { jobId: job.id, workerId: worker.id });
    const originalInsertNotification = marketplaceRepository.insertNotification;
    marketplaceRepository.insertNotification = async () => {
      throw new Error('injected notification failure');
    };

    try {
      await expect(acceptProposalService({ proposalId: proposal.id, customerId: customer.id }))
        .rejects.toThrow('injected notification failure');
    } finally {
      marketplaceRepository.insertNotification = originalInsertNotification;
    }

    const jobState = await testPool.query('SELECT status, assigned_worker_id FROM jobs WHERE id = $1', [job.id]);
    const proposalState = await testPool.query('SELECT status FROM proposals WHERE id = $1', [proposal.id]);
    expect(jobState.rows[0]).toMatchObject({ status: 'proposals_received', assigned_worker_id: null });
    expect(proposalState.rows[0].status).toBe('pending');
  });

  test('prevents a worker from withdrawing an accepted proposal', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-withdraw-accepted@fixly-test.local',
      fullName: 'Accepted Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-withdraw-accepted@fixly-test.local',
      fullName: 'Accepted Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id });
    const proposal = await createProposal(testPool, { jobId: job.id, workerId: worker.id });
    await testPool.query("UPDATE proposals SET status = 'accepted' WHERE id = $1", [proposal.id]);
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'assigned' WHERE id = $2", [worker.id, job.id]);

    await request(app)
      .put(`/api/proposals/${proposal.id}/withdraw`)
      .set('Authorization', authorizationFor(worker))
      .expect(409);
  });

  test('enforces one accepted proposal per job at the database boundary', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-accepted-constraint@fixly-test.local',
      fullName: 'Constraint Customer',
      role: 'customer',
    });
    const workerA = await createUser(testPool, {
      email: 'worker-a-accepted-constraint@fixly-test.local',
      fullName: 'Constraint Worker A',
      role: 'worker',
    });
    const workerB = await createUser(testPool, {
      email: 'worker-b-accepted-constraint@fixly-test.local',
      fullName: 'Constraint Worker B',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id, status: 'proposals_received' });
    const proposalA = await createProposal(testPool, { jobId: job.id, workerId: workerA.id });
    const proposalB = await createProposal(testPool, { jobId: job.id, workerId: workerB.id });

    await testPool.query("UPDATE proposals SET status = 'accepted' WHERE id = $1", [proposalA.id]);
    await expect(
      testPool.query("UPDATE proposals SET status = 'accepted' WHERE id = $1", [proposalB.id])
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('serializes concurrent proposal acceptance for one job', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-accept-race@fixly-test.local',
      fullName: 'Race Customer',
      role: 'customer',
    });
    const workerA = await createUser(testPool, {
      email: 'worker-a-accept-race@fixly-test.local',
      fullName: 'Race Worker A',
      role: 'worker',
    });
    const workerB = await createUser(testPool, {
      email: 'worker-b-accept-race@fixly-test.local',
      fullName: 'Race Worker B',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id, status: 'proposals_received' });
    const proposalA = await createProposal(testPool, { jobId: job.id, workerId: workerA.id });
    const proposalB = await createProposal(testPool, { jobId: job.id, workerId: workerB.id });

    const customerAuth = authorizationFor(customer);
    const responses = await Promise.all([
      request(app).put(`/api/proposals/${proposalA.id}/accept`).set('Authorization', customerAuth),
      request(app).put(`/api/proposals/${proposalB.id}/accept`).set('Authorization', customerAuth),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);

    const accepted = await testPool.query(
      "SELECT COUNT(*)::int AS count FROM proposals WHERE job_id = $1 AND status = 'accepted'",
      [job.id]
    );
    expect(accepted.rows[0].count).toBe(1);
    const assigned = await testPool.query('SELECT assigned_worker_id, status FROM jobs WHERE id = $1', [job.id]);
    expect(assigned.rows[0].status).toBe('assigned');
    expect([workerA.id, workerB.id]).toContain(assigned.rows[0].assigned_worker_id);
  });

  test('rejects a payment dispute after that payment was confirmed', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-payment-state@fixly-test.local',
      fullName: 'Payment Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-payment-state@fixly-test.local',
      fullName: 'Payment Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'payment_recorded' WHERE id = $2", [worker.id, job.id]);
    const payment = await testPool.query(
      'INSERT INTO payments (job_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [job.id, '4000.00', 'cash', customer.id]
    );
    const workerAuth = authorizationFor(worker);

    await request(app)
      .put(`/api/payments/${payment.rows[0].id}/confirm`)
      .set('Authorization', workerAuth)
      .expect(200);

    await request(app)
      .put(`/api/payments/${payment.rows[0].id}/dispute`)
      .set('Authorization', workerAuth)
      .expect(409);
  });

  test.fails('requires a selected agent worker to belong to the stored recommendations', async () => {
    const customer = await createUser(testPool, {
      email: 'customer-agent-selection@fixly-test.local',
      fullName: 'Agent Customer',
      role: 'customer',
    });
    const worker = await createUser(testPool, {
      email: 'worker-agent-selection@fixly-test.local',
      fullName: 'Unrecommended Worker',
      role: 'worker',
    });
    const job = await createJob(testPool, { customerId: customer.id });
    const run = await testPool.query(
      `INSERT INTO agent_runs (user_id, agent_type, status, job_id)
       VALUES ($1, 'match', 'awaiting_confirmation', $2) RETURNING id`,
      [customer.id, job.id]
    );

    await request(app)
      .post(`/api/agent/run/${run.rows[0].id}/confirm`)
      .set('Authorization', authorizationFor(customer))
      .send({ action_type: 'invite', selections: [worker.id] })
      .expect(400);
  });
});
