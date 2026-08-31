const { Pool } = require('pg');
require('dotenv').config();
const { loadDatabaseConfig } = require('../config/env');
const { currentContext } = require('../observability/request-context');

/** @typedef {{ queries: number, failures: number, slowQueries: number, totalDurationMs: number }} QueryMetrics */
/** @typedef {import('pg').PoolClient} PoolClient */
/** @typedef {import('pg').Pool & { queryMetrics: () => QueryMetrics }} ObservablePool */

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

/** @type {QueryMetrics} */
const metrics = { queries: 0, failures: 0, slowQueries: 0, totalDurationMs: 0 };
/** @type {WeakSet<PoolClient>} */
const instrumentedClients = new WeakSet();

/** @param {unknown[]} args */
function queryName(args) {
  const input = args[0];
  const statement = typeof input === 'string'
    ? input
    : typeof input === 'object' && input !== null && 'text' in input && typeof input.text === 'string'
      ? input.text
      : undefined;
  return typeof statement === 'string' ? statement.trim().split(/\s+/, 1)[0]?.toUpperCase() : 'QUERY';
}

/** @param {(...args: any[]) => Promise<any>} query */
function instrumentQuery(query) {
  /** @param {...any} args */
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
      sqlstate: typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined,
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
/** @type {(...args: any[]) => any} */
const poolConnect = pool.connect.bind(pool);
/** @param {PoolClient} client @returns {PoolClient} */
function instrumentClient(client) {
  if (!instrumentedClients.has(client)) {
    client.query = instrumentQuery(client.query.bind(client));
    instrumentedClients.add(client);
  }
  return client;
}
const instrumentedConnect = /** @param {...any} args */ (...args) => {
  const callback = args.find(argument => typeof argument === 'function');
  if (callback) {
    return poolConnect(/** @param {Error | undefined} error @param {PoolClient | undefined} client @param {(release?: any) => void} release */
      (error, client, release) => callback(error, client && instrumentClient(client), release));
  }
  return poolConnect(...args).then(instrumentClient);
};
/** @type {any} */ (pool).connect = instrumentedConnect;

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/** @type {ObservablePool} */
const observablePool = /** @type {any} */ (pool);
observablePool.queryMetrics = () => ({ ...metrics, averageDurationMs: metrics.queries ? metrics.totalDurationMs / metrics.queries : 0 });

module.exports = observablePool;
