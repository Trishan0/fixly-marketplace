'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../src/db/migrations');
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9][a-z0-9_-]*\.sql$/i;
const MIGRATION_LOCK_NAME = 'fixly_schema_migrations';
const APPLICATION_TABLES = [
  'categories',
  'users',
  'worker_profiles',
  'worker_skills',
  'jobs',
  'job_photos',
  'worker_portfolio_photos',
  'proposals',
  'invites',
  'payments',
  'reviews',
  'reports',
  'notifications',
  'agent_runs',
  'agent_run_steps',
  'agent_memories',
  'agent_recommendations',
  'rate_limit_buckets',
];

class MigrationError extends Error {
  constructor(message, code = 'MIGRATION_ERROR') {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
  }
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function discoverMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map(entry => {
      const filePath = path.join(migrationsDir, entry.name);
      const contents = fs.readFileSync(filePath);
      return {
        filename: entry.name,
        filePath,
        sql: contents.toString('utf8'),
        checksum: checksum(contents),
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

async function relationExists(client, relationName) {
  const result = await client.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public.${relationName}`]
  );
  return result.rows[0].exists;
}

async function hasApplicationSchema(client) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
     WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
     ) AS exists`,
    [APPLICATION_TABLES]
  );
  return result.rows[0].exists;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      checksum   CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readAppliedMigrations(client) {
  const result = await client.query(
    'SELECT filename, checksum, applied_at FROM schema_migrations ORDER BY filename'
  );
  return result.rows;
}

function validateMigrationHistory(migrations, appliedRows) {
  const discovered = new Map(migrations.map(migration => [migration.filename, migration]));

  for (const applied of appliedRows) {
    const migration = discovered.get(applied.filename);
    if (!migration) {
      throw new MigrationError(
        `Applied migration file is missing from source: ${applied.filename}`,
        'MIGRATION_FILE_MISSING'
      );
    }

    if (migration.checksum !== applied.checksum.trim()) {
      throw new MigrationError(
        `Applied migration was modified: ${applied.filename}`,
        'MIGRATION_CHECKSUM_MISMATCH'
      );
    }
  }
}

function createPool(connectionString) {
  if (!connectionString) {
    throw new MigrationError('A database connection string is required', 'DATABASE_URL_REQUIRED');
  }
  return new Pool({ connectionString });
}

async function inspectMigrations({ connectionString, migrationsDir = DEFAULT_MIGRATIONS_DIR }) {
  const migrations = discoverMigrations(migrationsDir);
  const pool = createPool(connectionString);
  let client;

  try {
    client = await pool.connect();
    const historyExists = await relationExists(client, 'schema_migrations');
    const legacySchema = await hasApplicationSchema(client);

    if (!historyExists) {
      return {
        state: legacySchema ? 'legacy' : 'uninitialized',
        applied: [],
        pending: migrations.map(migration => migration.filename),
      };
    }

    const appliedRows = await readAppliedMigrations(client);
    validateMigrationHistory(migrations, appliedRows);

    if (appliedRows.length === 0 && legacySchema) {
      return {
        state: 'legacy',
        applied: [],
        pending: migrations.map(migration => migration.filename),
      };
    }

    const appliedNames = new Set(appliedRows.map(row => row.filename));
    return {
      state: 'tracked',
      applied: appliedRows,
      pending: migrations
        .filter(migration => !appliedNames.has(migration.filename))
        .map(migration => migration.filename),
    };
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

async function runMigrations({
  connectionString,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  logger = console,
}) {
  const migrations = discoverMigrations(migrationsDir);
  const pool = createPool(connectionString);
  let client;
  const appliedNow = [];

  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);

    const historyExists = await relationExists(client, 'schema_migrations');
    const legacySchema = await hasApplicationSchema(client);

    if (!historyExists && legacySchema) {
      throw new MigrationError(
        'Existing Fixly tables were found without migration history. Run the guarded legacy baseline command before migrating.',
        'LEGACY_SCHEMA_REQUIRES_BASELINE'
      );
    }

    await ensureMigrationTable(client);
    const appliedRows = await readAppliedMigrations(client);

    if (appliedRows.length === 0 && legacySchema) {
      throw new MigrationError(
        'Existing Fixly tables were found with empty migration history. Run the guarded legacy baseline command before migrating.',
        'LEGACY_SCHEMA_REQUIRES_BASELINE'
      );
    }

    validateMigrationHistory(migrations, appliedRows);
    const appliedNames = new Set(appliedRows.map(row => row.filename));

    for (const migration of migrations) {
      if (appliedNames.has(migration.filename)) continue;

      logger.info(`Applying migration ${migration.filename}`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [migration.filename, migration.checksum]
        );
        await client.query('COMMIT');
        appliedNow.push(migration.filename);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    if (appliedNow.length === 0) logger.info('Database migrations are up to date');
    return { applied: appliedNow };
  } finally {
    if (client) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME]);
      } catch {
        // Releasing the database connection also releases the session advisory lock.
      }
      client.release();
    }
    await pool.end();
  }
}

module.exports = {
  APPLICATION_TABLES,
  DEFAULT_MIGRATIONS_DIR,
  MIGRATION_LOCK_NAME,
  MigrationError,
  checksum,
  discoverMigrations,
  ensureMigrationTable,
  hasApplicationSchema,
  inspectMigrations,
  readAppliedMigrations,
  relationExists,
  runMigrations,
  validateMigrationHistory,
};
