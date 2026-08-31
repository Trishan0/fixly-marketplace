const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  QUERY_CANCELED: '57014',
  CONNECTION_EXCEPTION: '08000',
};

class DatabaseError extends Error {
  constructor({ code, message, retryable = false, cause }) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.code = code;
    this.retryable = retryable;
  }
}

function classifyDatabaseError(error) {
  switch (error?.code) {
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

module.exports = { DatabaseError, SQLSTATE, classifyDatabaseError };
