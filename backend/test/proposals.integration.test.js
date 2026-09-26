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

async function setup() {
  const customer = await createUser(testPool, { email: 'prop-customer@fixly-test.local', fullName: 'Proposal Customer', role: 'customer' });
  const worker = await createUser(testPool, { email: 'prop-worker@fixly-test.local', fullName: 'Proposal Worker', role: 'worker' });
  return { customer, worker }
}

describe('job posting rules', () => {
  test('a fixed-price job needs a budget', async () => {
    const customer = await createUser(testPool, { email: 'budget-customer@fixly-test.local', fullName: 'Budget Customer', role: 'customer' });
    const category = await testPool.query("SELECT id FROM categories WHERE name = 'Plumbing'");
    const base = { title: 'Fix a tap', description: 'Kitchen tap is dripping all day.', category_id: category.rows[0].id, district: 'Colombo' };
    const refused = await request(app).post('/api/jobs').set('Authorization', authorizationFor(customer)).send({ ...base, pricing_mode: 'fixed' }).expect(400);
    expect(refused.body.error).toMatch(/budget/);
    await request(app).post('/api/jobs').set('Authorization', authorizationFor(customer)).send({ ...base, pricing_mode: 'fixed', fixed_budget: '3500' }).expect(201);
    await request(app).post('/api/jobs').set('Authorization', authorizationFor(customer)).send({ ...base, pricing_mode: 'ask_quotes' }).expect(201);
  });
});

describe('worker proposals', () => {
  test('lists a worker\'s proposals with job context and counts', async () => {
    const { customer, worker } = await setup();
    const other = await createUser(testPool, { email: 'prop-other@fixly-test.local', fullName: 'Other Worker', role: 'worker' });
    const openJob = await createJob(testPool, { customerId: customer.id, title: 'Paint the gate' });
    const lostJob = await createJob(testPool, { customerId: customer.id, title: 'Fix the roof' });
    await createProposal(testPool, { jobId: openJob.id, workerId: worker.id });
    const lost = await createProposal(testPool, { jobId: lostJob.id, workerId: worker.id });
    await testPool.query("UPDATE proposals SET status = 'declined' WHERE id = $1", [lost.id]);
    await testPool.query("UPDATE jobs SET assigned_worker_id = $1, status = 'assigned' WHERE id = $2", [other.id, lostJob.id]);

    const all = await request(app).get('/api/proposals/mine').set('Authorization', authorizationFor(worker)).expect(200);
    expect(all.body.counts).toMatchObject({ total: 2, pending: 1, declined: 1, accepted: 0, withdrawn: 0 });
    expect(all.body.proposals).toHaveLength(2);

    const declined = await request(app).get('/api/proposals/mine?status=declined').set('Authorization', authorizationFor(worker)).expect(200);
    expect(declined.body.proposals).toHaveLength(1);
    expect(declined.body.proposals[0]).toMatchObject({ job_title: 'Fix the roof', hired_someone_else: true, customer_name: 'Proposal Customer' });

    await request(app).get('/api/proposals/mine').set('Authorization', authorizationFor(customer)).expect(403);
  });

  test('edits a pending proposal, requires a price or inspection, and tells the customer', async () => {
    const { customer, worker } = await setup();
    const job = await createJob(testPool, { customerId: customer.id });
    const proposal = await createProposal(testPool, { jobId: job.id, workerId: worker.id, price: '5000.00' });
    const auth = authorizationFor(worker);

    await request(app).put(`/api/proposals/${proposal.id}`).set('Authorization', auth).send({ availability: 'Tomorrow' }).expect(400);
    const updated = await request(app)
      .put(`/api/proposals/${proposal.id}`)
      .set('Authorization', auth)
      .send({ proposed_price: '4500', availability: 'Tomorrow 9am', message: 'Can bring the parts.' })
      .expect(200);
    expect(updated.body).toMatchObject({ proposed_price: '4500.00', availability: 'Tomorrow 9am' });

    const notice = await testPool.query("SELECT title FROM notifications WHERE user_id = $1 AND type = 'new_proposal'", [customer.id]);
    expect(notice.rows.map(row => row.title)).toContain('Proposal updated');

    const stranger = await createUser(testPool, { email: 'prop-stranger@fixly-test.local', fullName: 'Stranger', role: 'worker' });
    await request(app).put(`/api/proposals/${proposal.id}`).set('Authorization', authorizationFor(stranger)).send({ proposed_price: '1' }).expect(404);

    await testPool.query("UPDATE proposals SET status = 'accepted' WHERE id = $1", [proposal.id]);
    await request(app).put(`/api/proposals/${proposal.id}`).set('Authorization', auth).send({ proposed_price: '4000' }).expect(409);
  });

  test('an accepted invite becomes a real quote once the worker adds a price', async () => {
    const { customer, worker } = await setup();
    const job = await createJob(testPool, { customerId: customer.id, title: 'Service two AC units' });
    const invite = await testPool.query('INSERT INTO invites (job_id, customer_id, worker_id) VALUES ($1, $2, $3) RETURNING id', [job.id, customer.id, worker.id]);
    const auth = authorizationFor(worker);

    await request(app).put(`/api/invites/${invite.rows[0].id}/accept`).set('Authorization', auth).expect(200);
    const placeholder = await testPool.query('SELECT id, proposed_price FROM proposals WHERE job_id = $1 AND worker_id = $2', [job.id, worker.id]);
    expect(placeholder.rows[0].proposed_price).toBeNull();

    await request(app).put(`/api/proposals/${placeholder.rows[0].id}`).set('Authorization', auth).send({ inspection_needed: true, availability: 'Weekends' }).expect(200);
    const notice = await testPool.query("SELECT title, body FROM notifications WHERE user_id = $1 AND type = 'new_proposal' ORDER BY created_at DESC LIMIT 1", [customer.id]);
    expect(notice.rows[0]).toMatchObject({ title: 'Quote received' });
  });

  test('withdrawing notifies the customer', async () => {
    const { customer, worker } = await setup();
    const job = await createJob(testPool, { customerId: customer.id, title: 'Tile the bathroom' });
    const proposal = await createProposal(testPool, { jobId: job.id, workerId: worker.id });
    await request(app).put(`/api/proposals/${proposal.id}/withdraw`).set('Authorization', authorizationFor(worker)).expect(200);
    const notice = await testPool.query("SELECT body FROM notifications WHERE user_id = $1 AND type = 'proposal_withdrawn'", [customer.id]);
    expect(notice.rows[0].body).toContain('Proposal Worker withdrew their proposal for: Tile the bathroom');
  });
});
