const { Pool } = require('pg');
require('dotenv').config();
const { loadDatabaseConfig } = require('../config/env');
const { currentContext } = require('../observability/request-context');

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
const instrumentedClients = new WeakSet();

function queryName(args) {
  const statement = typeof args[0] === 'string' ? args[0] : args[0]?.text;
  return typeof statement === 'string' ? statement.trim().split(/\s+/, 1)[0]?.toUpperCase() : 'QUERY';
}

function instrumentQuery(query) {
  return async (...args) => {
  const started = performance.now();
  const context = currentContext();
  try { const result = await query(...args); metrics.queries += 1; return result; }
  catch (error) {
    metrics.queries += 1;
    metrics.failures += 1;
    console.error(JSON.stringify({
      event: 'database_query_failed',
      operation: context.databaseOperation || 'infrastructure',
      request_id: context.requestId,
      statement_kind: queryName(args),
      sqlstate: error.code,
    }));
    throw error;
  }
  finally {
    const duration = performance.now() - started; metrics.totalDurationMs += duration;
    if (duration >= databaseConfig.slowQueryMs) {
      metrics.slowQueries += 1;
      console.warn(JSON.stringify({
        event: 'slow_database_query',
        operation: context.databaseOperation || 'infrastructure',
        request_id: context.requestId,
        statement_kind: queryName(args),
        duration_ms: Math.round(duration),
      }));
    }
  }
  };
}

const poolQuery = pool.query.bind(pool);
pool.query = instrumentQuery(poolQuery);
const poolConnect = pool.connect.bind(pool);
function instrumentClient(client) {
  if (!instrumentedClients.has(client)) {
    client.query = instrumentQuery(client.query.bind(client));
    instrumentedClients.add(client);
  }
  return client;
}
pool.connect = (...args) => {
  const callback = args.find(argument => typeof argument === 'function');
  if (callback) {
    return poolConnect((error, client, release) => callback(error, client && instrumentClient(client), release));
  }
  return poolConnect(...args).then(instrumentClient);
};

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
module.exports.queryMetrics = () => ({ ...metrics, averageDurationMs: metrics.queries ? metrics.totalDurationMs / metrics.queries : 0 });
