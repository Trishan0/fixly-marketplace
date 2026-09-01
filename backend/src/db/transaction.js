const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('./index');
const { SQLSTATE, sqlState } = require('./errors');

/** @typedef {'read committed' | 'repeatable read' | 'serializable'} IsolationLevel */
/** @typedef {'read only' | 'read write'} AccessMode */
/** @typedef {{ isolationLevel?: IsolationLevel, accessMode?: AccessMode, deferrable?: boolean, maxRetries?: number, retryDelayMs?: number, onRetry?: (event: { attempt: number, error: unknown, delay: number }) => void }} TransactionOptions */
/** @typedef {ReturnType<typeof drizzle<Record<string, never>, import('pg').PoolClient>>} DrizzleTransactionClient */
/** @typedef {{ tx: DrizzleTransactionClient, client: import('pg').PoolClient, attempt: number }} TransactionContext */

const ISOLATION_LEVELS = new Set(['read committed', 'repeatable read', 'serializable']);
const ACCESS_MODES = new Set(['read only', 'read write']);

/** @param {TransactionOptions} [options] */
function transactionStatement({ isolationLevel = 'read committed', accessMode = 'read write', deferrable = false } = {}) {
  if (!ISOLATION_LEVELS.has(isolationLevel)) throw new Error('Unsupported transaction isolation level');
  if (!ACCESS_MODES.has(accessMode)) throw new Error('Unsupported transaction access mode');
  if (deferrable && (isolationLevel !== 'serializable' || accessMode !== 'read only')) {
    throw new Error('Deferrable transactions must be serializable and read only');
  }
  const deferrableClause = deferrable ? ' DEFERRABLE' : '';
  return `BEGIN ISOLATION LEVEL ${isolationLevel.toUpperCase()} ${accessMode.toUpperCase()}${deferrableClause}`;
}

/** @param {unknown} error */
function isRetryableTransactionError(error) {
  const code = sqlState(error);
  return code === SQLSTATE.SERIALIZATION_FAILURE || code === SQLSTATE.DEADLOCK_DETECTED;
}

/** @param {number} milliseconds */
function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** @template T @param {(context: TransactionContext) => Promise<T> | T} work @param {TransactionOptions} [options] @returns {Promise<T>} */
async function withTransaction(work, options = {}) {
  if (typeof work !== 'function') throw new TypeError('withTransaction requires a callback');

  const { maxRetries = 0, retryDelayMs = 25, onRetry, ...transactionOptions } = options;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new RangeError('maxRetries must be an integer between 0 and 5');
  }
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 5_000) {
    throw new RangeError('retryDelayMs must be an integer between 0 and 5000');
  }

  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query(transactionStatement(transactionOptions));
      const tx = drizzle({ client });
      const result = await work({ tx, client, attempt });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // A failed connection may already have discarded the transaction.
      }

      if (!isRetryableTransactionError(error) || attempt >= maxRetries) throw error;
      const delay = Math.min(retryDelayMs * (2 ** attempt), 5_000);
      if (typeof onRetry === 'function') onRetry({ attempt: attempt + 1, error, delay });
      if (delay > 0) await wait(delay);
    } finally {
      client.release();
    }
  }
}

module.exports = { isRetryableTransactionError, transactionStatement, withTransaction };
