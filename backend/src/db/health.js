const pool = require('./index');

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

module.exports = { checkDatabaseReadiness, closeDatabase, poolMetrics };
