const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  QUERY_CANCELED: '57014',
  CONNECTION_EXCEPTION: '08000',
};

/** @typedef {{ code: string, message: string, retryable?: boolean, cause?: unknown }} DatabaseErrorOptions */

class DatabaseError extends Error {
  /** @param {DatabaseErrorOptions} options */
  constructor({ code, message, retryable = false, cause }) {
    super(message, { cause });
    this.name = 'DatabaseError';
    /** @type {string} */
    this.code = code;
    /** @type {boolean} */
    this.retryable = retryable;
  }
}

/** @param {unknown} value @returns {value is { code?: unknown, cause?: unknown }} */
function hasDriverShape(value) {
  return typeof value === 'object' && value !== null;
}

/** @param {unknown} error @returns {string | undefined} */
function sqlState(error) {
  let current = error;
  for (let depth = 0; hasDriverShape(current) && depth < 4; depth += 1, current = current.cause) {
    if (typeof current.code === 'string') return current.code;
  }
  return undefined;
}

/** @param {unknown} error @returns {DatabaseError} */
function classifyDatabaseError(error) {
  switch (sqlState(error)) {
    case SQLSTATE.UNIQUE_VIOLATION:
      return new DatabaseError({ code: 'CONFLICT', message: 'A conflicting record already exists', cause: error });
    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      return new DatabaseError({ code: 'REFERENCE_INVALID', message: 'A related record no longer exists', cause: error });
    case SQLSTATE.CHECK_VIOLATION:
      return new DatabaseError({ code: 'CONSTRAINT_VIOLATION', message: 'The requested state is invalid', cause: error });
    case SQLSTATE.SERIALIZATION_FAILURE:
    case SQLSTATE.DEADLOCK_DETECTED:
      return new DatabaseError({ code: 'TRANSACTION_RETRYABLE', message: 'The request conflicted with another operation', retryable: true, cause: error });
    case SQLSTATE.QUERY_CANCELED:
      return new DatabaseError({ code: 'DATABASE_TIMEOUT', message: 'The database operation timed out', retryable: true, cause: error });
    default:
      return new DatabaseError({ code: 'DATABASE_FAILURE', message: 'The database operation failed', cause: error });
  }
}

module.exports = { DatabaseError, SQLSTATE, classifyDatabaseError, sqlState };
