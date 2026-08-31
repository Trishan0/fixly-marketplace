#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { inspectMigrations, runMigrations } = require('./lib/migrations');
const { loadDatabaseConfig } = require('../src/config/env');

function usage() {
  console.log(`Usage: node scripts/migrate.js [--status] [--env VARIABLE]

Options:
  --status        Show applied and pending migrations without changing the database
  --env VARIABLE Read the connection string from VARIABLE instead of DATABASE_URL
  --help          Show this help

Examples:
  node scripts/migrate.js
  node scripts/migrate.js --status
  node scripts/migrate.js --env TEST_DATABASE_URL`);
}

function parseArgs(argv) {
  const options = { status: false, envName: 'DATABASE_URL' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--status') {
      options.status = true;
    } else if (arg === '--env') {
      const envName = argv[index + 1];
      if (!envName || !/^[A-Z][A-Z0-9_]*$/.test(envName)) {
        throw new Error('--env requires an uppercase environment variable name');
      }
      options.envName = envName;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const connectionString = options.envName === 'DATABASE_URL'
    ? loadDatabaseConfig().migrationConnectionString
    : process.env[options.envName];
  if (!connectionString) {
    throw new Error(options.envName === 'DATABASE_URL'
      ? 'DATABASE_MIGRATION_URL, MIGRATION_DATABASE_URL, or DATABASE_URL is required'
      : `${options.envName} is required`);
  }

  if (options.status) {
    const status = await inspectMigrations({ connectionString });
    console.log(`Migration state: ${status.state}`);
    console.log(`Applied: ${status.applied.length}`);
    for (const migration of status.applied) console.log(`  [applied] ${migration.filename}`);
    console.log(`Pending: ${status.pending.length}`);
    for (const filename of status.pending) console.log(`  [pending] ${filename}`);

    if (status.state === 'legacy') {
      console.error('Existing Fixly tables have no migration history. Review docs/database/migrations.md before baselining.');
      process.exitCode = 2;
    }
    return;
  }

  const result = await runMigrations({ connectionString });
  if (result.applied.length > 0) {
    console.log(`Applied ${result.applied.length} migration(s)`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Migration failed [${error.code || 'ERROR'}]: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs };
