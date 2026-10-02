'use strict';

const request = require('supertest');
const app = require('../src/app');
const appPool = require('../src/db');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');
const {
  authorizationFor,
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

async function recordedPayment({ customer, worker }) {
  const job = await createJob(testPool, { customerId: customer.id });
  await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'payment_recorded' WHERE id = $2", [worker.id, job.id]);
  const payment = await testPool.query(
    'INSERT INTO payments (job_id, amount, method, recorded_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [job.id, '4000.00', 'cash', customer.id]
  );
  return { job, paymentId: payment.rows[0].id };
}

describe('customer job listing and summary', () => {
  test('filters by status group, pages, and summarises across every job', async () => {
    const customer = await createUser(testPool, { email: 'summary-customer@fixly-test.local', fullName: 'Summary Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'summary-worker@fixly-test.local', fullName: 'Summary Worker', role: 'worker' });
    for (let i = 0; i < 6; i += 1) await createJob(testPool, { customerId: customer.id, title: `Active job ${i}` });
    const reviewJob = await createJob(testPool, { customerId: customer.id, title: 'Needs review', status: 'proposals_received' });
    await createProposal(testPool, { jobId: reviewJob.id, workerId: worker.id });
    await createJob(testPool, { customerId: customer.id, title: 'Cancelled job', status: 'cancelled' });
    const { job: paidJob } = await recordedPayment({ customer, worker });
    const auth = authorizationFor(customer);

    const summary = await request(app).get('/api/jobs/my/summary').set('Authorization', auth).expect(200);
    expect(summary.body).toMatchObject({ total: 9, active: 7, completed: 1, cancelled: 1, awaiting_review: 1 });
    expect(Number(summary.body.total_spent)).toBe(4000);

    const cancelled = await request(app).get('/api/jobs/my?group=cancelled').set('Authorization', auth).expect(200);
    expect(cancelled.body.map(job => job.title)).toEqual(['Cancelled job']);

    const completed = await request(app).get('/api/jobs/my?group=completed').set('Authorization', auth).expect(200);
    expect(completed.body.map(job => job.id)).toEqual([paidJob.id]);

    const searched = await request(app).get('/api/jobs/my?search=needs%20rev').set('Authorization', auth).expect(200);
    expect(searched.body.map(job => job.title)).toEqual(['Needs review']);
    expect(searched.body[0].pending_proposal_count).toBe(1);

    const firstPage = await request(app).get('/api/jobs/my?group=active&limit=5&page=1').set('Authorization', auth).expect(200);
    const secondPage = await request(app).get('/api/jobs/my?group=active&limit=5&page=2').set('Authorization', auth).expect(200);
    expect(firstPage.body).toHaveLength(5);
    expect(secondPage.body).toHaveLength(2);
  });
});

describe('worker job feed filters', () => {
  test('splits jobs by this worker\'s proposal state and searches titles', async () => {
    const customer = await createUser(testPool, { email: 'feed-customer@fixly-test.local', fullName: 'Feed Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'feed-worker@fixly-test.local', fullName: 'Feed Worker', role: 'worker' });
    const openJob = await createJob(testPool, { customerId: customer.id, title: 'Fix garden tap' });
    const sentJob = await createJob(testPool, { customerId: customer.id, title: 'Replace ceiling fan' });
    const declinedJob = await createJob(testPool, { customerId: customer.id, title: 'Paint front wall' });
    await createProposal(testPool, { jobId: sentJob.id, workerId: worker.id });
    const declined = await createProposal(testPool, { jobId: declinedJob.id, workerId: worker.id });
    await testPool.query("UPDATE proposals SET status = 'declined' WHERE id = $1", [declined.id]);
    const auth = authorizationFor(worker);

    const open = await request(app).get('/api/jobs/feed?proposal=open').set('Authorization', auth).expect(200);
    expect(open.body.map(job => job.id)).toEqual([openJob.id]);
    const sent = await request(app).get('/api/jobs/feed?proposal=sent').set('Authorization', auth).expect(200);
    expect(sent.body.map(job => job.id)).toEqual([sentJob.id]);
    const rejected = await request(app).get('/api/jobs/feed?proposal=declined').set('Authorization', auth).expect(200);
    expect(rejected.body.map(job => job.id)).toEqual([declinedJob.id]);
    const searched = await request(app).get('/api/jobs/feed?search=ceiling').set('Authorization', auth).expect(200);
    expect(searched.body.map(job => job.id)).toEqual([sentJob.id]);
  });
});

describe('payment disputes', () => {
  test('requires a reason and shows it to the customer', async () => {
    const customer = await createUser(testPool, { email: 'dispute-customer@fixly-test.local', fullName: 'Dispute Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'dispute-worker@fixly-test.local', fullName: 'Dispute Worker', role: 'worker' });
    const { job, paymentId } = await recordedPayment({ customer, worker });
    const workerAuth = authorizationFor(worker);

    await request(app).put(`/api/payments/${paymentId}/dispute`).set('Authorization', workerAuth).send({}).expect(400);
    await request(app)
      .put(`/api/payments/${paymentId}/dispute`)
      .set('Authorization', workerAuth)
      .send({ reason: 'I was paid LKR 3,000, not 4,000' })
      .expect(200);

    const detail = await request(app).get(`/api/jobs/${job.id}`).set('Authorization', authorizationFor(customer)).expect(200);
    expect(detail.body.payment_disputed).toBe(true);
    expect(detail.body.payment_dispute_reason).toBe('I was paid LKR 3,000, not 4,000');
    const notification = await testPool.query("SELECT body FROM notifications WHERE user_id = $1 AND type = 'payment_disputed'", [customer.id]);
    expect(notification.rows[0].body).toContain('I was paid LKR 3,000, not 4,000');
  });
});

describe('NIC review', () => {
  test('rejecting requires a reason, clears the image, and lets the worker upload again', async () => {
    const admin = await createUser(testPool, { email: 'nic-admin@fixly-test.local', fullName: 'NIC Admin', role: 'admin' });
    const worker = await createUser(testPool, { email: 'nic-worker@fixly-test.local', fullName: 'NIC Worker', role: 'worker' });
    await testPool.query("UPDATE users SET nic_image_path = '/uploads/nic-front.jpg' WHERE id = $1", [worker.id]);
    const adminAuth = authorizationFor(admin);
    const workerAuth = authorizationFor(worker);

    let me = await request(app).get('/api/auth/me').set('Authorization', workerAuth).expect(200);
    expect(me.body.nic_status).toBe('pending');
    expect(me.body).not.toHaveProperty('nic_image_path');

    await request(app).put(`/api/admin/users/${worker.id}/reject-nic`).set('Authorization', adminAuth).send({}).expect(400);
    await request(app)
      .put(`/api/admin/users/${worker.id}/reject-nic`)
      .set('Authorization', adminAuth)
      .send({ reason: 'Photo is blurry' })
      .expect(200);

    me = await request(app).get('/api/auth/me').set('Authorization', workerAuth).expect(200);
    expect(me.body).toMatchObject({ nic_status: 'rejected', nic_rejection_reason: 'Photo is blurry', is_nic_verified: false });
    const stored = await testPool.query('SELECT nic_image_path FROM users WHERE id = $1', [worker.id]);
    expect(stored.rows[0].nic_image_path).toBeNull();
    const audit = await testPool.query("SELECT reason FROM admin_audit_logs WHERE action = 'reject_nic' AND entity_id = $1", [worker.id]);
    expect(audit.rows[0].reason).toBe('Photo is blurry');

    await testPool.query("UPDATE users SET nic_image_path = '/uploads/nic-new.jpg', nic_rejection_reason = NULL WHERE id = $1", [worker.id]);
    await request(app).put(`/api/admin/users/${worker.id}/verify-nic`).set('Authorization', adminAuth).send({ verified: true }).expect(200);
    me = await request(app).get('/api/auth/me').set('Authorization', workerAuth).expect(200);
    expect(me.body.nic_status).toBe('verified');
    const notice = await testPool.query("SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'nic_verified'", [worker.id]);
    expect(notice.rowCount).toBe(1);
  });

  test('suspending a user requires a reason', async () => {
    const admin = await createUser(testPool, { email: 'suspend-admin@fixly-test.local', fullName: 'Suspend Admin', role: 'admin' });
    const customer = await createUser(testPool, { email: 'suspend-customer@fixly-test.local', fullName: 'Suspend Customer', role: 'customer' });
    const adminAuth = authorizationFor(admin);

    await request(app).put(`/api/admin/users/${customer.id}/suspend`).set('Authorization', adminAuth).send({ suspended: true }).expect(400);
    await request(app).put(`/api/admin/users/${customer.id}/suspend`).set('Authorization', adminAuth).send({ suspended: true, reason: 'Repeated abusive messages' }).expect(200);
    await request(app).put(`/api/admin/users/${customer.id}/suspend`).set('Authorization', adminAuth).send({ suspended: false }).expect(200);
  });
});

describe('email verification resend', () => {
  test('issues a fresh token for unverified users and refuses verified ones', async () => {
    const unverified = await createUser(testPool, { email: 'resend-unverified@fixly-test.local', fullName: 'Resend User', role: 'customer', isEmailVerified: false });
    const verified = await createUser(testPool, { email: 'resend-verified@fixly-test.local', fullName: 'Verified User', role: 'customer' });

    await request(app).post('/api/auth/resend-verification').set('Authorization', authorizationFor(unverified)).expect(200);
    const token = await testPool.query('SELECT email_verify_token_hash, email_verify_expires_at FROM users WHERE id = $1', [unverified.id]);
    expect(token.rows[0].email_verify_token_hash).toBeTruthy();
    expect(new Date(token.rows[0].email_verify_expires_at).getTime()).toBeGreaterThan(Date.now());

    await request(app).post('/api/auth/resend-verification').set('Authorization', authorizationFor(verified)).expect(409);
  });
});

describe('customer profile privacy', () => {
  test('only signed-in users can view a customer profile', async () => {
    const customer = await createUser(testPool, { email: 'private-customer@fixly-test.local', fullName: 'Private Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'viewer-worker@fixly-test.local', fullName: 'Viewer Worker', role: 'worker' });

    await request(app).get(`/api/customers/${customer.id}`).expect(401);
    const profile = await request(app).get(`/api/customers/${customer.id}`).set('Authorization', authorizationFor(worker)).expect(200);
    expect(profile.body.full_name).toBe('Private Customer');
  });
});

describe('public marketplace data', () => {
  test('reports live stats and a worker\'s full review count', async () => {
    const customer = await createUser(testPool, { email: 'stats-customer@fixly-test.local', fullName: 'Stats Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'stats-worker@fixly-test.local', fullName: 'Stats Worker', role: 'worker', district: 'Kandy' });
    await createUser(testPool, { email: 'stats-worker-2@fixly-test.local', fullName: 'Second Worker', role: 'worker', district: 'Galle' });
    for (let i = 0; i < 12; i += 1) {
      const job = await createJob(testPool, { customerId: customer.id, title: `Reviewed job ${i}` });
      await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'reviewed' WHERE id = $2", [worker.id, job.id]);
      await testPool.query('INSERT INTO reviews (job_id, customer_id, worker_id, rating) VALUES ($1, $2, $3, $4)', [job.id, customer.id, worker.id, i % 2 ? 5 : 4]);
    }

    const stats = await request(app).get('/api/workers/stats').expect(200);
    expect(stats.body).toMatchObject({ workers: 2, districts: 2, reviews: 12, avg_rating: '4.5', completed_jobs: 12 });

    const profile = await request(app).get(`/api/workers/${worker.id}`).expect(200);
    expect(profile.body.review_count).toBe(12);
    const firstPage = await request(app).get(`/api/workers/${worker.id}/reviews`).expect(200);
    expect(firstPage.body).toHaveLength(10);
  });
});

describe('completed job history on profiles', () => {
  test('lists only finished jobs and shows them without private details', async () => {
    const customer = await createUser(testPool, { email: 'history-customer@fixly-test.local', fullName: 'History Customer', role: 'customer' });
    const worker = await createUser(testPool, { email: 'history-worker@fixly-test.local', fullName: 'History Worker', role: 'worker' });
    const done = await createJob(testPool, { customerId: customer.id, title: 'Fixed the geyser' });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'reviewed', final_price = 7500, address = '12 Private Lane' WHERE id = $2", [worker.id, done.id]);
    await testPool.query('INSERT INTO reviews (job_id, customer_id, worker_id, rating, feedback) VALUES ($1, $2, $3, 5, $4)', [done.id, customer.id, worker.id, 'Spotless work']);
    const inProgress = await createJob(testPool, { customerId: customer.id, title: 'Still going' });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'in_progress' WHERE id = $2", [worker.id, inProgress.id]);
    const takenDown = await createJob(testPool, { customerId: customer.id, title: 'Taken down' });
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'completed', is_active = false, flagged_at = NOW() WHERE id = $2", [worker.id, takenDown.id]);

    const workerJobs = await request(app).get(`/api/workers/${worker.id}/jobs`).expect(200);
    expect(workerJobs.body.total).toBe(1);
    expect(workerJobs.body.jobs.map(job => job.title)).toEqual(['Fixed the geyser']);
    expect(workerJobs.body.jobs[0].rating).toBe(5);

    await request(app).get(`/api/customers/${customer.id}/jobs`).expect(401);
    const customerJobs = await request(app).get(`/api/customers/${customer.id}/jobs`).set('Authorization', authorizationFor(worker)).expect(200);
    expect(customerJobs.body.jobs.map(job => job.id)).toEqual([done.id]);
    const profile = await request(app).get(`/api/customers/${customer.id}`).set('Authorization', authorizationFor(worker)).expect(200);
    expect(profile.body.recent_jobs.map(job => job.title)).toEqual(['Still going']);

    const detail = await request(app).get(`/api/jobs/${done.id}/public`).expect(200);
    expect(detail.body).toMatchObject({ title: 'Fixed the geyser', worker_name: 'History Worker', review_rating: 5, review_feedback: 'Spotless work', final_price: '7500.00' });
    expect(detail.body.address).toBeUndefined();
    expect(detail.body.customer_phone).toBeUndefined();
    await request(app).get(`/api/jobs/${inProgress.id}/public`).expect(404);
    await request(app).get(`/api/jobs/${takenDown.id}/public`).expect(404);
  });
});

describe('worker starting price', () => {
  test('is optional: a worker can set it, keep it while editing other fields, and clear it', async () => {
    const worker = await createUser(testPool, { email: 'price-worker@fixly-test.local', fullName: 'Price Worker', role: 'worker' });
    const auth = authorizationFor(worker);
    const price = async () => (await testPool.query('SELECT starting_price FROM worker_profiles WHERE user_id = $1', [worker.id])).rows[0].starting_price;

    await request(app).put('/api/profile/me').set('Authorization', auth).send({ starting_price: '2500' }).expect(200);
    expect(await price()).toBe('2500');

    await request(app).put('/api/profile/me').set('Authorization', auth).send({ bio: 'Plumber' }).expect(200);
    expect(await price()).toBe('2500');

    await request(app).put('/api/profile/me').set('Authorization', auth).send({ starting_price: null }).expect(200);
    expect(await price()).toBeNull();
  });
});

describe('suggested questions for a job draft', () => {
  test('customers only; falls back to the guide questions when Gemini is unavailable', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const customer = await createUser(testPool, { email: 'clarify-customer@fixly-test.local', fullName: 'Clarify Customer', role: 'customer' });
      const worker = await createUser(testPool, { email: 'clarify-worker@fixly-test.local', fullName: 'Clarify Worker', role: 'worker' });
      const body = { title: 'Pipe is broken', description: 'Pipe is broken, water everywhere' };

      await request(app).post('/api/jobs/clarify').send(body).expect(401);
      await request(app).post('/api/jobs/clarify').set('Authorization', authorizationFor(worker)).send(body).expect(403);
      await request(app).post('/api/jobs/clarify').set('Authorization', authorizationFor(customer)).send({ description: 'short' }).expect(400);
      const response = await request(app).post('/api/jobs/clarify').set('Authorization', authorizationFor(customer)).send(body).expect(200);
      expect(response.body).toEqual({ source: 'guide', reason: 'ai_unavailable', questions: [] });
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});

describe('worker catalog filters and sort', () => {
  test('filters by rating and new workers, sorts, and pages without repeats', async () => {
    const make = async (email, name, jobs, rating) => {
      const w = await createUser(testPool, { email, fullName: name, role: 'worker' });
      await testPool.query('UPDATE worker_profiles SET total_jobs_done = $1, avg_rating = $2 WHERE id = $3', [jobs, rating, w.worker_profile_id]);
      return w;
    };
    await make('cat-top@fixly-test.local', 'Top Rated', 10, 4.9);
    await make('cat-busy@fixly-test.local', 'Most Jobs', 40, 4.2);
    await make('cat-new@fixly-test.local', 'Brand New', 0, 0);
    await make('cat-two@fixly-test.local', 'Two Jobs', 2, 5);
    const names = (res) => res.body.workers.map(w => w.full_name);

    expect(names(await request(app).get('/api/workers?min_rating=4.5').expect(200))).toEqual(['Two Jobs', 'Top Rated']);
    const fresh = await request(app).get('/api/workers?new_only=true').expect(200);
    expect(fresh.body.total).toBe(2);
    expect(names(fresh).sort()).toEqual(['Brand New', 'Two Jobs']);
    expect(names(await request(app).get('/api/workers?sort=jobs').expect(200))[0]).toBe('Most Jobs');
    expect(names(await request(app).get('/api/workers?sort=newest').expect(200))[0]).toBe('Two Jobs');

    // One 5-star review doesn't outrank many reviews at 4.9.
    const customer = await createUser(testPool, { email: 'cat-reviewer@fixly-test.local', fullName: 'Reviewer', role: 'customer' });
    const reviewed = async (workerName, ratings) => {
      const worker = (await testPool.query('SELECT id FROM users WHERE full_name = $1', [workerName])).rows[0];
      for (const rating of ratings) {
        const job = await createJob(testPool, { customerId: customer.id });
        await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'reviewed' WHERE id = $2", [worker.id, job.id]);
        await testPool.query('INSERT INTO reviews (job_id, customer_id, worker_id, rating) VALUES ($1, $2, $3, $4)', [job.id, customer.id, worker.id, rating]);
      }
    };
    // Platform average ends up around 4.3, a realistic spread.
    await reviewed('Most Jobs', [4, 4, 3, 4, 3, 4]);
    await reviewed('Two Jobs', [5]);
    await reviewed('Top Rated', [5, 5, 5, 5, 5, 5, 5, 5, 5, 4]);
    expect(names(await request(app).get('/api/workers?sort=rating').expect(200)).slice(0, 2)).toEqual(['Top Rated', 'Two Jobs']);
    await request(app).get('/api/workers?sort=price; DROP TABLE users').expect(400);

    const pages = [];
    for (let page = 1; page <= 4; page += 1) pages.push(...names(await request(app).get(`/api/workers?limit=1&page=${page}`).expect(200)));
    expect(new Set(pages).size).toBe(4);
  });
});
