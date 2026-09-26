'use strict';

const request = require('supertest');
const app = require('../src/app');
const appPool = require('../src/db');
const { createTestPool, migrateTestDatabase, resetTestDatabase } = require('./support/database');
const { authorizationFor, createJob, createProposal, createUser } = require('./support/marketplace');

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

async function participants() {
  const customer = await createUser(testPool, { email: 'msg-customer@fixly-test.local', fullName: 'Message Customer', role: 'customer' });
  const worker = await createUser(testPool, { email: 'msg-worker@fixly-test.local', fullName: 'Message Worker', role: 'worker' });
  const stranger = await createUser(testPool, { email: 'msg-stranger@fixly-test.local', fullName: 'Stranger Worker', role: 'worker' });
  const job = await createJob(testPool, { customerId: customer.id, title: 'Fix the kitchen sink' });
  return { customer, worker, stranger, job };
}

describe('job messaging', () => {
  test('customer and applicant can exchange messages; unread counts and read receipts work', async () => {
    const { customer, worker, job } = await participants();
    await createProposal(testPool, { jobId: job.id, workerId: worker.id });
    const customerAuth = authorizationFor(customer);
    const workerAuth = authorizationFor(worker);
    const thread = `/api/messages/${job.id}/${worker.id}`;

    await request(app).post(thread).set('Authorization', customerAuth).send({ body: 'Can you come on Saturday?' }).expect(201);
    await request(app).post(thread).set('Authorization', customerAuth).send({ body: 'Morning is best.' }).expect(201);

    // Only one notification for a batch of unread messages
    const notices = await testPool.query("SELECT body, meta FROM notifications WHERE user_id = $1 AND type = 'new_message'", [worker.id]);
    expect(notices.rowCount).toBe(1);
    expect(notices.rows[0].meta).toEqual({ job_id: job.id, worker_id: worker.id });

    let unread = await request(app).get('/api/messages/unread-count').set('Authorization', workerAuth).expect(200);
    expect(unread.body.unread).toBe(2);

    const conversations = await request(app).get('/api/messages/conversations').set('Authorization', workerAuth).expect(200);
    expect(conversations.body).toHaveLength(1);
    expect(conversations.body[0]).toMatchObject({ job_title: 'Fix the kitchen sink', other_name: 'Message Customer', last_message: 'Morning is best.', unread_count: 2 });

    const opened = await request(app).get(thread).set('Authorization', workerAuth).expect(200);
    expect(opened.body.messages.map(m => m.body)).toEqual(['Can you come on Saturday?', 'Morning is best.']);
    expect(opened.body.thread).toMatchObject({ can_send: true, viewer_role: 'worker' });

    unread = await request(app).get('/api/messages/unread-count').set('Authorization', workerAuth).expect(200);
    expect(unread.body.unread).toBe(0);

    await request(app).post(thread).set('Authorization', workerAuth).send({ body: 'Saturday 9am works.' }).expect(201);
    const customerView = await request(app).get(thread).set('Authorization', customerAuth).expect(200);
    expect(customerView.body.messages).toHaveLength(3);
    expect(customerView.body.messages[0].read_at).not.toBeNull();
  });

  test('blocks people outside the job and validates the message', async () => {
    const { customer, worker, stranger, job } = await participants();
    const otherCustomer = await createUser(testPool, { email: 'msg-other@fixly-test.local', fullName: 'Other Customer', role: 'customer' });
    const thread = `/api/messages/${job.id}/${worker.id}`;

    // Worker hasn't applied or been invited yet
    await request(app).post(thread).set('Authorization', authorizationFor(customer)).send({ body: 'Hello' }).expect(403);

    await testPool.query('INSERT INTO invites (job_id, customer_id, worker_id) VALUES ($1, $2, $3)', [job.id, customer.id, worker.id]);
    await request(app).post(thread).set('Authorization', authorizationFor(customer)).send({ body: 'Hello' }).expect(201);

    await request(app).get(thread).set('Authorization', authorizationFor(otherCustomer)).expect(404);
    await request(app).get(thread).set('Authorization', authorizationFor(stranger)).expect(404);
    await request(app).get(`/api/messages/${job.id}/not-a-uuid`).set('Authorization', authorizationFor(customer)).expect(404);
    await request(app).post(thread).set('Authorization', authorizationFor(customer)).send({ body: '   ' }).expect(400);
    await request(app).post(thread).set('Authorization', authorizationFor(customer)).send({ body: 'x'.repeat(2001) }).expect(400);
  });

  test('closes the conversation when the job goes to another worker or is cancelled', async () => {
    const { customer, worker, stranger, job } = await participants();
    await createProposal(testPool, { jobId: job.id, workerId: worker.id });
    await createProposal(testPool, { jobId: job.id, workerId: stranger.id });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'assigned' WHERE id = $2", [stranger.id, job.id]);

    const thread = `/api/messages/${job.id}/${worker.id}`;
    const view = await request(app).get(thread).set('Authorization', authorizationFor(worker)).expect(200);
    expect(view.body.thread).toMatchObject({ can_send: false });
    expect(view.body.thread.blocked_reason).toMatch(/another worker/);
    await request(app).post(thread).set('Authorization', authorizationFor(worker)).send({ body: 'Still available?' }).expect(403);

    // The hired worker can still talk to the customer
    await request(app).post(`/api/messages/${job.id}/${stranger.id}`).set('Authorization', authorizationFor(stranger)).send({ body: 'On my way' }).expect(201);

    await testPool.query("UPDATE jobs SET status = 'cancelled' WHERE id = $1", [job.id]);
    await request(app).post(`/api/messages/${job.id}/${stranger.id}`).set('Authorization', authorizationFor(customer)).send({ body: 'Sorry' }).expect(403);
  });

  test('records job status history for the timeline', async () => {
    const { customer, job } = await participants();
    await testPool.query("UPDATE jobs SET status = 'proposals_received' WHERE id = $1", [job.id]);
    await testPool.query("UPDATE jobs SET title = 'Renamed' WHERE id = $1", [job.id]);
    const events = await testPool.query('SELECT status FROM job_status_events WHERE job_id = $1 ORDER BY created_at, status', [job.id]);
    expect(events.rows.map(row => row.status)).toEqual(['posted', 'proposals_received']);
    expect(customer.id).toBeTruthy();
  });
});
