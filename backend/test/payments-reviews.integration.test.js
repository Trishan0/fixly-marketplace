'use strict';

const request = require('supertest');
const app = require('../src/app');
const marketplaceRepository = require('../src/modules/marketplace/repository');
const { createReview, recordPayment } = require('../src/modules/marketplace/service');
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

async function completedJob(customer, worker, finalPrice = '4500.00') {
  const job = await createJob(testPool, { customerId: customer.id });
  await testPool.query(
    "UPDATE jobs SET assigned_worker_id = $1, status = 'completed', final_price = $2 WHERE id = $3",
    [worker.id, finalPrice, job.id]
  );
  return job;
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

describe('Phase 4 payment and review invariants', () => {
  test('serializes duplicate payment recording and stores exact decimal totals', async () => {
    const customer = await createUser(testPool, { email: 'payment-race-customer@fixly-test.local', fullName: 'Payment Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'payment-race-worker@fixly-test.local', fullName: 'Payment Worker', role: 'worker' });
    const job = await completedJob(customer, worker, '1250.50');
    const auth = authorizationFor(customer);

    const responses = await Promise.all([
      request(app).post(`/api/jobs/${job.id}/payment`).set('Authorization', auth).send({ method: 'cash' }),
      request(app).post(`/api/jobs/${job.id}/payment`).set('Authorization', auth).send({ method: 'cash' }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 400]);

    const payment = await testPool.query('SELECT amount, status, worker_confirmed, disputed FROM payments WHERE job_id = $1', [job.id]);
    expect(payment.rows).toEqual([{ amount: '1250.50', status: 'recorded', worker_confirmed: false, disputed: false }]);
  });

  test('enforces payment state transitions and amount immutability in PostgreSQL', async () => {
    const customer = await createUser(testPool, { email: 'payment-db-customer@fixly-test.local', fullName: 'Database Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'payment-db-worker@fixly-test.local', fullName: 'Database Worker', role: 'worker' });
    const job = await completedJob(customer, worker);
    const payment = await testPool.query(
      "INSERT INTO payments (job_id, amount, method, recorded_by) VALUES ($1, '4500.00', 'cash', $2) RETURNING id",
      [job.id, customer.id]
    );

    await testPool.query("UPDATE payments SET status = 'confirmed' WHERE id = $1", [payment.rows[0].id]);
    await expect(testPool.query("UPDATE payments SET status = 'disputed' WHERE id = $1", [payment.rows[0].id]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(testPool.query("UPDATE payments SET amount = '1.00' WHERE id = $1", [payment.rows[0].id]))
      .rejects.toMatchObject({ code: '23514' });
  });

  test('review atomically updates the job, aggregate, and notification', async () => {
    const customer = await createUser(testPool, { email: 'review-customer@fixly-test.local', fullName: 'Review Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'review-worker@fixly-test.local', fullName: 'Review Worker', role: 'worker' });
    const job = await completedJob(customer, worker);

    const review = await createReview({ jobId: job.id, customerId: customer.id, input: { rating: 4, feedback: 'Well done' } });
    expect(review.rating).toBe(4);
    const aggregate = await testPool.query('SELECT avg_rating, total_jobs_done FROM worker_profiles WHERE user_id = $1', [worker.id]);
    const state = await testPool.query('SELECT status FROM jobs WHERE id = $1', [job.id]);
    expect(aggregate.rows[0]).toEqual({ avg_rating: '4.00', total_jobs_done: 1 });
    expect(state.rows[0].status).toBe('reviewed');
  });

  test('rolls back payment and review workflows if a required notification fails', async () => {
    const customer = await createUser(testPool, { email: 'rollback-payment-customer@fixly-test.local', fullName: 'Rollback Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'rollback-payment-worker@fixly-test.local', fullName: 'Rollback Worker', role: 'worker' });
    const paymentJob = await completedJob(customer, worker);
    const reviewJob = await completedJob(customer, worker);
    const original = marketplaceRepository.insertNotification;
    marketplaceRepository.insertNotification = async () => { throw new Error('injected notification failure'); };

    try {
      await expect(recordPayment({ jobId: paymentJob.id, customerId: customer.id, input: { method: 'cash' } }))
        .rejects.toThrow('injected notification failure');
      await expect(createReview({ jobId: reviewJob.id, customerId: customer.id, input: { rating: 5 } }))
        .rejects.toThrow('injected notification failure');
    } finally {
      marketplaceRepository.insertNotification = original;
    }

    const payments = await testPool.query('SELECT COUNT(*)::int AS count FROM payments WHERE job_id = $1', [paymentJob.id]);
    const jobs = await testPool.query('SELECT id, status FROM jobs WHERE id IN ($1, $2) ORDER BY id', [paymentJob.id, reviewJob.id]);
    const reviews = await testPool.query('SELECT COUNT(*)::int AS count FROM reviews WHERE job_id = $1', [reviewJob.id]);
    expect(payments.rows[0].count).toBe(0);
    expect(jobs.rows.every(job => job.status === 'completed')).toBe(true);
    expect(reviews.rows[0].count).toBe(0);
  });
});
