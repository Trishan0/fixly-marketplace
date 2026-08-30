#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { runMigrations } = require('./scripts/lib/migrations');
const { seedDemoDatabase } = require('./scripts/seed-demo');

async function setup() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');

  if (!process.argv.includes('--seed-only')) {
    await runMigrations({ connectionString });
  }
  await seedDemoDatabase({ connectionString });
}

setup().catch(error => {
  console.error(`Database setup failed: ${error.message}`);
  process.exitCode = 1;
});
