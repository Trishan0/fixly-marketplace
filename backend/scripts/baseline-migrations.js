#!/usr/bin/env node
'use strict';

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const {
  MIGRATION_LOCK_NAME,
  discoverMigrations,
  ensureMigrationTable,
  readAppliedMigrations,
} = require('./lib/migrations');

const CONFIRMATION_FLAG = '--confirm-legacy-schema';

async function hasTables(client, tableNames) {
  const result = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tableNames]
  );
  const found = new Set(result.rows.map(row => row.table_name));
  return tableNames.every(tableName => found.has(tableName));
}

async function hasColumns(client, tableName, columnNames) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
    [tableName, columnNames]
  );
  const found = new Set(result.rows.map(row => row.column_name));
  return columnNames.every(columnName => found.has(columnName));
}

async function inspectLegacyMigrations(client) {
  const initialTables = [
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
  ];
  const authColumns = [
    'email_verify_token_hash',
    'email_verify_expires_at',
    'password_reset_token_hash',
    'password_reset_expires_at',
  ];
  const agentTables = [
    'agent_runs',
    'agent_run_steps',
    'agent_memories',
    'agent_recommendations',
  ];

  const initialPresent = await hasTables(client, initialTables);
  const authPresent = initialPresent && await hasColumns(client, 'users', authColumns);
  const agentsPresent = initialPresent && await hasTables(client, agentTables);
  let agentStatusLengthIsCurrent = false;

  if (agentsPresent) {
    const lengthResult = await client.query(
      `SELECT character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'agent_runs' AND column_name = 'status'`
    );
    agentStatusLengthIsCurrent = Number(lengthResult.rows[0]?.character_maximum_length) >= 50;
  }

  return {
    '001_initial.sql': initialPresent,
    '002_auth_hardening.sql': authPresent,
    '003_agent_tables.sql': agentsPresent && agentStatusLengthIsCurrent,
  };
}

async function main() {
  if (!process.argv.slice(2).includes(CONFIRMATION_FLAG)) {
    console.error('Refusing to baseline without explicit confirmation.');
    console.error('First review docs/database/migrations.md, back up the database, then run:');
    console.error(`  npm run db:migrate:baseline -- ${CONFIRMATION_FLAG}`);
    process.exitCode = 2;
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const migrations = discoverMigrations();
  const migrationByName = new Map(migrations.map(migration => [migration.filename, migration]));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);
    const detected = await inspectLegacyMigrations(client);
    const knownNames = Object.keys(detected);

    if (!detected['001_initial.sql']) {
      throw new Error('The legacy database does not contain the complete initial Fixly table set');
    }

    if (detected['003_agent_tables.sql'] && !detected['002_auth_hardening.sql']) {
      throw new Error('Agent schema exists but authentication hardening columns are incomplete; repair the schema before baselining');
    }

    for (const filename of knownNames) {
      if (!migrationByName.has(filename)) {
        throw new Error(`Required migration file is missing: ${filename}`);
      }
    }

    await ensureMigrationTable(client);
    const existingHistory = await readAppliedMigrations(client);
    if (existingHistory.length > 0) {
      throw new Error('Migration history already contains rows; use db:migrate:status instead of baselining again');
    }

    const baselineNames = knownNames.filter(filename => detected[filename]);
    await client.query('BEGIN');
    try {
      for (const filename of baselineNames) {
        const migration = migrationByName.get(filename);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, migration.checksum]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(`Baselined ${baselineNames.length} existing migration(s):`);
    for (const filename of baselineNames) console.log(`  ${filename}`);

    const missing = knownNames.filter(filename => !detected[filename]);
    if (missing.length > 0) {
      console.log('Not baselined; run db:migrate to apply:');
      for (const filename of missing) console.log(`  ${filename}`);
    }
  } finally {
    if (client) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME]);
      } catch {
        // Releasing the connection also releases the session advisory lock.
      }
      client.release();
    }
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Migration baseline failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { hasColumns, hasTables, inspectLegacyMigrations, main };
