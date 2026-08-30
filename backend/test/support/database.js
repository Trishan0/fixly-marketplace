'use strict';

const { Pool } = require('pg');
const { runMigrations } = require('../../scripts/lib/migrations');

function databaseName(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL');
  }
}

function requireSafeTestDatabaseUrl() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database test helpers require NODE_ENV=test');
  }

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

  const name = databaseName(testUrl);
  if (!/(^|[_-])test([_-]|$)/i.test(name)) {
    throw new Error(`Refusing to use a database without an explicit test name: ${name}`);
  }

  const originalUrl = process.env.FIXLY_ORIGINAL_DATABASE_URL;
  if (originalUrl && originalUrl === testUrl) {
    throw new Error('TEST_DATABASE_URL must not equal the normal DATABASE_URL');
  }

  return testUrl;
}

async function migrateTestDatabase() {
  return runMigrations({
    connectionString: requireSafeTestDatabaseUrl(),
    logger: { info: () => {} },
  });
}

function createTestPool() {
  return new Pool({ connectionString: requireSafeTestDatabaseUrl() });
}

async function resetTestDatabase(pool) {
  requireSafeTestDatabaseUrl();
  await pool.query(`
    TRUNCATE TABLE
      rate_limit_buckets,
      agent_run_steps,
      agent_recommendations,
      agent_memories,
      agent_runs,
      notifications,
      reports,
      reviews,
      payments,
      invites,
      proposals,
      job_photos,
      jobs,
      worker_portfolio_photos,
      worker_skills,
      worker_profiles,
      users
    RESTART IDENTITY CASCADE
  `);
}

module.exports = {
  createTestPool,
  databaseName,
  migrateTestDatabase,
  requireSafeTestDatabaseUrl,
  resetTestDatabase,
};
