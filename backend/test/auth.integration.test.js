'use strict';

const request = require('supertest');
const {
  createTestPool,
  migrateTestDatabase,
  resetTestDatabase,
} = require('./support/database');

const app = require('../src/app');
const appPool = require('../src/db');
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

describe('authentication integration', () => {
  test('registers and logs in a customer', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Test Customer',
        email: 'customer@fixly-test.local',
        password: 'Testpass123',
        role: 'customer',
        district: 'Colombo',
      })
      .expect(201);

    expect(registration.body.token).toEqual(expect.any(String));
    expect(registration.body.user).toMatchObject({
      email: 'customer@fixly-test.local',
      role: 'customer',
      full_name: 'Test Customer',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@fixly-test.local', password: 'Testpass123' })
      .expect(200);

    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.user.role).toBe('customer');
  });

  test('creates a worker profile in the registration transaction', async () => {
    const category = await testPool.query(
      "SELECT name FROM categories WHERE name = 'Plumbing'"
    );
    expect(category.rowCount).toBe(1);

    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Test Worker',
        email: 'worker@fixly-test.local',
        password: 'Testpass123',
        role: 'worker',
        primary_skill: 'Plumbing',
      })
      .expect(201);

    const profile = await testPool.query(
      'SELECT primary_skill FROM worker_profiles WHERE user_id = $1',
      [registration.body.user.id]
    );
    expect(profile.rows).toEqual([{ primary_skill: 'Plumbing' }]);
  });

  test('rejects duplicate registration and invalid credentials', async () => {
    const payload = {
      full_name: 'Duplicate Customer',
      email: 'duplicate@fixly-test.local',
      password: 'Testpass123',
      role: 'customer',
    };

    await request(app).post('/api/auth/register').send(payload).expect(201);
    await request(app).post('/api/auth/register').send(payload).expect(409);
    await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'Wrongpass123' })
      .expect(401);
  });

  test('enforces case-insensitive email identity and never persists a raw verification token', async () => {
    const payload = {
      full_name: 'Case Sensitive Customer',
      email: 'Case.Identity@fixly-test.local',
      password: 'Testpass123',
      role: 'customer',
    };
    const registration = await request(app).post('/api/auth/register').send(payload).expect(201);

    await request(app).post('/api/auth/register').send({ ...payload, email: 'case.identity@fixly-test.local' }).expect(409);
    const stored = await testPool.query(
      'SELECT email, email_verify_token, email_verify_token_hash FROM users WHERE id = $1',
      [registration.body.user.id]
    );
    expect(stored.rows[0].email).toBe('case.identity@fixly-test.local');
    expect(stored.rows[0].email_verify_token).toBeNull();
    expect(stored.rows[0].email_verify_token_hash).toEqual(expect.any(String));
    await expect(testPool.query(
      "UPDATE users SET email_verify_token = 'raw-token' WHERE id = $1",
      [registration.body.user.id]
    )).rejects.toMatchObject({ code: '23514' });
  });

  test('rejects protected access without a token', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);
    expect(response.body.error).toBe('No token provided');
  });
});
