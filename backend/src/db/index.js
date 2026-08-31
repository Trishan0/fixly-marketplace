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

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
