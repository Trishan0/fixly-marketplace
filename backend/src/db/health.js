const fs = require('fs');
const path = require('path');
const pool = require('./index');

const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9][a-z0-9_-]*\.sql$/i;

/**
 * The newest migration shipped with this code, or null if the migration files
 * are not bundled (then only the baseline table check runs).
 * @returns {string | null}
 */
function latestBundledMigration(migrationsDir = path.join(__dirname, 'migrations')) {
  try {
    const files = fs.readdirSync(migrationsDir).filter(name => MIGRATION_FILE_PATTERN.test(name)).sort();
    return files.at(-1) || null;
  } catch {
    return null;
  }
}

const LATEST_MIGRATION = latestBundledMigration();

/** @type {number} */
let readinessFailures = 0;
/** @type {Promise<void> | undefined} */
let shutdownPromise;

function poolMetrics() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    queries: pool.queryMetrics().queries,
    queryFailures: pool.queryMetrics().failures,
    slowQueries: pool.queryMetrics().slowQueries,
    readinessFailures,
  };
}

async function checkDatabaseReadiness() {
  try {
    const result = await pool.query(
      "SELECT to_regclass('public.rate_limit_buckets') IS NOT NULL AS schema_current"
    );
    if (!result.rows[0]?.schema_current) throw new Error('Database migrations are not current');
    // A missing newest migration means the code was deployed ahead of its schema.
    if (LATEST_MIGRATION) {
      const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [LATEST_MIGRATION]);
      if (applied.rowCount === 0) throw new Error(`Database migrations are not current: ${LATEST_MIGRATION} is pending`);
    }
    return { ready: true, metrics: poolMetrics() };
  } catch (error) {
    readinessFailures += 1;
    throw error;
  }
}

async function closeDatabase() {
  if (!shutdownPromise) shutdownPromise = pool.end();
  return shutdownPromise;
}

module.exports = { checkDatabaseReadiness, closeDatabase, latestBundledMigration, poolMetrics };
