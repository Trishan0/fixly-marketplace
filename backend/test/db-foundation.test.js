'use strict';

const { loadDatabaseConfig } = require('../src/config/env');
const { classifyDatabaseError } = require('../src/db/errors');
const { isRetryableTransactionError, transactionStatement } = require('../src/db/transaction');
const { normalizeSnapshot } = require('../scripts/verify-drizzle-schema');

describe('database foundation', () => {
  test('validates and normalizes database settings without creating a pool', () => {
    const config = loadDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:password@db.example/fixly',
      MIGRATION_DATABASE_URL: 'postgresql://migrator:password@db.example/fixly',
      DATABASE_POOL_MAX: '4',
      DATABASE_SSL_MODE: 'verify-full',
    });

    expect(config).toMatchObject({
      max: 4,
      migrationConnectionString: 'postgresql://migrator:password@db.example/fixly',
      ssl: { rejectUnauthorized: true },
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 30_000,
    });
  });

  test('prefers the canonical migration URL over the legacy compatibility name', () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: 'postgresql://runtime:password@db.example/fixly',
      DATABASE_MIGRATION_URL: 'postgresql://canonical:password@db.example/fixly',
      MIGRATION_DATABASE_URL: 'postgresql://legacy:password@db.example/fixly',
    });

    expect(config.migrationConnectionString).toBe('postgresql://canonical:password@db.example/fixly');
  });

  test('rejects invalid URLs and unsafe pool settings', () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: 'not-a-url' })).toThrow('Invalid database configuration');
    expect(() => loadDatabaseConfig({
      DATABASE_URL: 'postgresql://user:password@db.example/fixly',
      DATABASE_POOL_MAX: '0',
    })).toThrow('Invalid database configuration');
  });

  test('builds only valid transaction statements', () => {
    expect(transactionStatement()).toBe('BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE');
    expect(transactionStatement({ isolationLevel: 'serializable', accessMode: 'read only', deferrable: true }))
      .toBe('BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE');
    expect(() => transactionStatement({ isolationLevel: 'invalid' })).toThrow('Unsupported transaction isolation level');
    expect(() => transactionStatement({ deferrable: true })).toThrow('Deferrable transactions');
  });

  test('maps driver SQLSTATE values to stable, non-driver errors', () => {
    const unique = classifyDatabaseError({ code: '23505', detail: 'sensitive database detail' });
    const serializable = classifyDatabaseError({ code: '40001' });

    expect(unique).toMatchObject({ code: 'CONFLICT', retryable: false });
    expect(unique.message).not.toContain('sensitive');
    expect(serializable).toMatchObject({ code: 'TRANSACTION_RETRYABLE', retryable: true });
    expect(isRetryableTransactionError({ code: '40001' })).toBe(true);
    expect(isRetryableTransactionError({ code: '23505' })).toBe(false);
  });

  test('normalizes only non-schema Drizzle snapshot metadata for drift checks', () => {
    expect(normalizeSnapshot({
      id: 'generator-id',
      tables: { users: { schemaTo: 'public', columns: { id: { name: 'id', opclass: 'uuid_ops' } } } },
    })).toEqual({ tables: { users: { columns: { id: { name: 'id' } } } } });
  });
});
