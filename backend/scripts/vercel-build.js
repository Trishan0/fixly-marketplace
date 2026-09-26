#!/usr/bin/env node
'use strict';

// Vercel runs the `vercel-build` npm script instead of `build` when it exists.
// Production deploys apply pending migrations here, after the TypeScript build
// and before Vercel switches traffic, so new code never reaches a database
// that is missing its columns. If migrating fails the build fails and the
// previous deployment keeps serving.

const path = require('path');
const { execFileSync } = require('child_process');
const { runMigrations } = require('./lib/migrations');
const { loadDatabaseConfig } = require('../src/config/env');

const BACKEND_DIR = path.resolve(__dirname, '..');

function compileTypeScript() {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
  });
}

/**
 * Production deploys always migrate. Preview deploys only migrate when
 * MIGRATE_ON_BUILD=true, because previews usually share no database of
 * their own and must never change production's schema.
 * @param {NodeJS.ProcessEnv} env
 */
function shouldMigrate(env) {
  return env.VERCEL_ENV === 'production' || env.MIGRATE_ON_BUILD === 'true';
}

/**
 * The runner holds a session advisory lock, so it needs a direct (unpooled)
 * connection with its own credentials: DATABASE_MIGRATION_URL.
 * @param {NodeJS.ProcessEnv} env
 */
function migrationConnectionString(env) {
  if (!env.DATABASE_MIGRATION_URL && !env.MIGRATION_DATABASE_URL) {
    throw new Error(
      'DATABASE_MIGRATION_URL is not set for this deployment. Set it in Vercel to the direct (unpooled) '
      + 'Neon connection string so pending migrations can run before the new code goes live.',
    );
  }
  return loadDatabaseConfig({ ...env, NODE_ENV: 'production' }, { requireMigrationCredentials: true })
    .migrationConnectionString;
}

async function main({ env = process.env, compile = compileTypeScript, migrate = runMigrations, logger = console } = {}) {
  compile();

  if (!shouldMigrate(env)) {
    logger.log(`Skipping database migrations for the ${env.VERCEL_ENV || 'local'} build.`);
    return { migrated: false };
  }

  const result = await migrate({ connectionString: migrationConnectionString(env), logger });
  logger.log(result.applied.length > 0
    ? `Applied ${result.applied.length} migration(s) before deploying.`
    : 'Database schema is already up to date.');
  return { migrated: true, applied: result.applied };
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Deploy build failed [${error.code || 'ERROR'}]: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, shouldMigrate };
