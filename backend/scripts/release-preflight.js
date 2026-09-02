#!/usr/bin/env node
'use strict';

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { loadDatabaseConfig } = require('../src/config/env');
const { inspectMigrations } = require('./lib/migrations');

function databaseTarget(connectionString) {
  const url = new URL(connectionString);
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
}

async function releasePreflight(source = process.env) {
  const config = loadDatabaseConfig(source, { requireMigrationCredentials: true });
  if (source.NODE_ENV !== 'production') {
    throw new Error('Release preflight requires NODE_ENV=production');
  }

  const migrationStatus = await inspectMigrations({ connectionString: config.migrationConnectionString });
  if (migrationStatus.state !== 'tracked' || migrationStatus.pending.length > 0) {
    throw new Error(`Migration ledger is not current (state=${migrationStatus.state}, pending=${migrationStatus.pending.length})`);
  }

  const pool = new Pool({
    connectionString: config.connectionString,
    max: 1,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    statement_timeout: config.statement_timeout,
    ssl: config.ssl,
  });
  try {
    const readiness = await pool.query("SELECT to_regclass('public.rate_limit_buckets') IS NOT NULL AS schema_current");
    if (!readiness.rows[0]?.schema_current) throw new Error('Runtime role cannot verify the current application schema');
  } finally {
    await pool.end();
  }

  return {
    migrationTarget: databaseTarget(config.migrationConnectionString),
    runtimeTarget: databaseTarget(config.connectionString),
    appliedMigrations: migrationStatus.applied.length,
  };
}

if (require.main === module) {
  releasePreflight()
    .then(result => console.info(JSON.stringify({ event: 'database_release_preflight_passed', ...result })))
    .catch(error => {
      console.error(`Database release preflight failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { databaseTarget, releasePreflight };
