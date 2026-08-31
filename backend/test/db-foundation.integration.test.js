'use strict';

const { sql } = require('drizzle-orm');
const request = require('supertest');
const app = require('../src/app');
const { db, pool } = require('../src/db/drizzle');
const { withTransaction } = require('../src/db/transaction');
const { migrateTestDatabase, requireSafeTestDatabaseUrl } = require('./support/database');

describe('Drizzle shared-pool integration', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  test('serves readiness through the database health module', async () => {
    requireSafeTestDatabaseUrl();
    const response = await request(app).get('/api/ready').expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      database: 'connected',
      migrations: 'current',
    });
  });

  test('maps UUID, numeric, timestamp, JSONB, and nullable values through the shared client', async () => {
    requireSafeTestDatabaseUrl();
    const result = await db.execute(sql`
      SELECT
        '2f1a4f14-3126-4f8e-b4d4-a1f9a4c3d111'::uuid AS id,
        1250.50::numeric AS amount,
        '2026-01-02T03:04:05.000Z'::timestamptz AS created_at,
        '{"source":"drizzle"}'::jsonb AS metadata,
        NULL::text AS nullable_value
    `);
    const row = result.rows[0];

    expect(row).toMatchObject({
      id: '2f1a4f14-3126-4f8e-b4d4-a1f9a4c3d111',
      amount: '1250.50',
      metadata: { source: 'drizzle' },
      nullable_value: null,
    });
    // execute(sql`...`) is intentionally raw; typed table queries below apply
    // the reviewed timestamp mapper.
    expect(row.created_at).toBe('2026-01-02 03:04:05+00');
    expect(pool.totalCount).toBeGreaterThanOrEqual(1);
  });

  test('uses the reviewed schema timestamp mapper for typed table queries', async () => {
    requireSafeTestDatabaseUrl();
    const { users } = await import('../src/db/schema.ts');
    const email = `drizzle-timestamp-${Date.now()}@fixly-test.local`;
    const rows = await db.insert(users).values({
      fullName: 'Drizzle Timestamp Test',
      email,
      passwordHash: 'not-a-real-password-hash',
      role: 'customer',
    }).returning({ id: users.id, createdAt: users.createdAt, phone: users.phone });

    expect(rows[0].id).toEqual(expect.any(String));
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(rows[0].phone).toBeNull();
  });

  test('commits work through a transaction wrapping the legacy pool', async () => {
    requireSafeTestDatabaseUrl();
    const value = await withTransaction(async ({ tx }) => {
      const result = await tx.execute(sql`SELECT 42 AS value`);
      return result.rows[0].value;
    }, { isolationLevel: 'serializable', maxRetries: 1 });

    expect(value).toBe(42);
  });
});
