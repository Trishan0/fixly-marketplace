'use strict';

const request = require('supertest');
const app = require('../src/app');
const appPool = require('../src/db');
const { createTestPool, migrateTestDatabase, resetTestDatabase } = require('./support/database');
const { authorizationFor, createJob, createUser } = require('./support/marketplace');

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

async function people() {
  const admin = await createUser(testPool, { email: 'mod-admin@fixly-test.local', fullName: 'Mod Admin', role: 'admin' });
  const customer = await createUser(testPool, { email: 'mod-customer@fixly-test.local', fullName: 'Mod Customer', role: 'customer' });
  const worker = await createUser(testPool, { email: 'mod-worker@fixly-test.local', fullName: 'Mod Worker', role: 'worker' });
  return { admin, customer, worker };
}

describe('reports', () => {
  test('users can report a job or another user, but not themselves', async () => {
    const { admin, customer, worker } = await people();
    const job = await createJob(testPool, { customerId: customer.id, title: 'Suspicious job' });

    await request(app).post('/api/reports').set('Authorization', authorizationFor(worker))
      .send({ job_id: job.id, reported_user_id: customer.id, report_type: 'fake_job', description: 'Asked me to pay a deposit first.' })
      .expect(201);
    await request(app).post('/api/reports').set('Authorization', authorizationFor(worker))
      .send({ reported_user_id: worker.id, report_type: 'other', description: 'test' })
      .expect(400);

    const queue = await request(app).get('/api/admin/reports?status=open').set('Authorization', authorizationFor(admin)).expect(200);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({ report_type: 'fake_job', job_title: 'Suspicious job', reported_user_name: 'Mod Customer' });
  });
});

describe('job moderation', () => {
  test('taking a job down needs a reason, hides it, tells the customer, and can be undone', async () => {
    const { admin, customer, worker } = await people();
    const job = await createJob(testPool, { customerId: customer.id, title: 'Buy my phone' });
    const adminAuth = authorizationFor(admin);

    await request(app).put(`/api/admin/jobs/${job.id}/flag`).set('Authorization', adminAuth).send({}).expect(400);
    await request(app).put(`/api/admin/jobs/${job.id}/flag`).set('Authorization', adminAuth).send({ reason: 'Not a service job' }).expect(200);

    const feed = await request(app).get('/api/jobs/feed').set('Authorization', authorizationFor(worker)).expect(200);
    expect(feed.body.map(item => item.id)).not.toContain(job.id);
    const detail = await request(app).get(`/api/jobs/${job.id}`).set('Authorization', authorizationFor(customer)).expect(200);
    expect(detail.body).toMatchObject({ is_active: false, flag_reason: 'Not a service job' });
    const notice = await testPool.query("SELECT body FROM notifications WHERE user_id = $1 AND type = 'job_flagged'", [customer.id]);
    expect(notice.rows[0].body).toContain('Not a service job');

    const listed = await request(app).get('/api/admin/jobs').set('Authorization', adminAuth).expect(200);
    expect(listed.body.jobs[0]).toMatchObject({ id: job.id, is_active: false, flag_reason: 'Not a service job' });

    await request(app).put(`/api/admin/jobs/${job.id}/restore`).set('Authorization', adminAuth).send({}).expect(200);
    const restored = await request(app).get('/api/jobs/feed').set('Authorization', authorizationFor(worker)).expect(200);
    expect(restored.body.map(item => item.id)).toContain(job.id);
    await request(app).put(`/api/admin/jobs/${job.id}/restore`).set('Authorization', adminAuth).send({}).expect(404);
  });
});

describe('payment disputes queue', () => {
  test('admins see open disputes and close them with a note that both parties receive', async () => {
    const { admin, customer, worker } = await people();
    const job = await createJob(testPool, { customerId: customer.id, title: 'Paint the hall' });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'payment_recorded' WHERE id = $2", [worker.id, job.id]);
    const payment = await testPool.query('INSERT INTO payments (job_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4) RETURNING id', [job.id, '9000.00', 'cash', customer.id]);
    await request(app).put(`/api/payments/${payment.rows[0].id}/dispute`).set('Authorization', authorizationFor(worker)).send({ reason: 'Received only 6,000' }).expect(200);
    const adminAuth = authorizationFor(admin);

    const open = await request(app).get('/api/admin/disputes').set('Authorization', adminAuth).expect(200);
    expect(open.body).toHaveLength(1);
    expect(open.body[0]).toMatchObject({ job_title: 'Paint the hall', dispute_reason: 'Received only 6,000', customer_name: 'Mod Customer', worker_name: 'Mod Worker' });
    const stats = await request(app).get('/api/admin/stats').set('Authorization', adminAuth).expect(200);
    expect(stats.body.open_disputes).toBe(1);

    await request(app).put(`/api/admin/disputes/${payment.rows[0].id}/resolve`).set('Authorization', adminAuth).send({ note: '' }).expect(400);
    await request(app).put(`/api/admin/disputes/${payment.rows[0].id}/resolve`).set('Authorization', adminAuth).send({ note: 'Customer paid the remaining 3,000' }).expect(200);
    await request(app).put(`/api/admin/disputes/${payment.rows[0].id}/resolve`).set('Authorization', adminAuth).send({ note: 'again' }).expect(404);

    const stillOpen = await request(app).get('/api/admin/disputes').set('Authorization', adminAuth).expect(200);
    expect(stillOpen.body).toHaveLength(0);
    const resolved = await request(app).get('/api/admin/disputes?state=resolved').set('Authorization', adminAuth).expect(200);
    expect(resolved.body[0]).toMatchObject({ dispute_resolution_note: 'Customer paid the remaining 3,000', resolved_by_name: 'Mod Admin' });
    const notices = await testPool.query("SELECT user_id FROM notifications WHERE type = 'dispute_resolved'");
    expect(notices.rows.map(row => row.user_id).sort()).toEqual([customer.id, worker.id].sort());
  });
});
