const { Pool } = require('pg');
require('dotenv').config();
const { loadDatabaseConfig } = require('../config/env');

const databaseConfig = loadDatabaseConfig();
const pool = new Pool({
  connectionString: databaseConfig.connectionString,
  // Keep each serverless instance's local pool intentionally small. Neon handles
  // cross-instance concurrency through the pooled (-pooler) connection string.
  max: databaseConfig.max,
  idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
  connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
  statement_timeout: databaseConfig.statement_timeout,
  idle_in_transaction_session_timeout: databaseConfig.idle_in_transaction_session_timeout,
  ssl: databaseConfig.ssl,
});

const metrics = { queries: 0, failures: 0, slowQueries: 0, totalDurationMs: 0 };
const poolQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const started = performance.now();
  try { const result = await poolQuery(...args); metrics.queries += 1; return result; }
  catch (error) { metrics.queries += 1; metrics.failures += 1; throw error; }
  finally {
    const duration = performance.now() - started; metrics.totalDurationMs += duration;
    if (duration >= databaseConfig.slowQueryMs) { metrics.slowQueries += 1; console.warn(JSON.stringify({ event: 'slow_database_query', duration_ms: Math.round(duration) })); }
  }
};

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
module.exports.queryMetrics = () => ({ ...metrics, averageDurationMs: metrics.queries ? metrics.totalDurationMs / metrics.queries : 0 });
