'use strict';

const { loadDatabaseConfig } = require('../src/config/env');
const { classifyDatabaseError } = require('../src/db/errors');
const { isRetryableTransactionError, transactionStatement } = require('../src/db/transaction');
const { normalizeSnapshot } = require('../scripts/verify-drizzle-schema');
const { databaseTarget } = require('../scripts/release-preflight');
const { parseArgs: parseEvidenceArgs, parseReleaseEvidence } = require('../scripts/verify-release-evidence');

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
      NODE_ENV: 'development',
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

  test('permits a runtime-only production configuration while enforcing verified TLS', () => {
    const runtime = 'postgresql://runtime:password@db.example/fixly';

    expect(loadDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: runtime, DATABASE_SSL_MODE: 'verify-full' }))
      .toMatchObject({ connectionString: runtime, migrationConnectionString: runtime });
    expect(() => loadDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: runtime, DATABASE_SSL_MODE: 'require' }))
      .toThrow('verify-full');
  });

  test('requires separate migration credentials only for production migration commands', () => {
    const runtime = 'postgresql://runtime:password@db.example/fixly';
    const migrator = 'postgresql://migrator:password@db.example/fixly';
    const productionRuntime = { NODE_ENV: 'production', DATABASE_URL: runtime, DATABASE_SSL_MODE: 'verify-full' };

    expect(() => loadDatabaseConfig(productionRuntime, { requireMigrationCredentials: true }))
      .toThrow('DATABASE_MIGRATION_URL is required');
    expect(() => loadDatabaseConfig({ ...productionRuntime, DATABASE_MIGRATION_URL: runtime }, { requireMigrationCredentials: true }))
      .toThrow('separate credentials');
    expect(loadDatabaseConfig({ ...productionRuntime, DATABASE_MIGRATION_URL: migrator }, { requireMigrationCredentials: true }))
      .toMatchObject({ migrationConnectionString: migrator });
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
    expect(isRetryableTransactionError({ cause: { code: '40001' } })).toBe(true);
    expect(isRetryableTransactionError({ code: '23505' })).toBe(false);
  });

  test('normalizes only non-schema Drizzle snapshot metadata for drift checks', () => {
    expect(normalizeSnapshot({
      id: 'generator-id',
      tables: { users: { schemaTo: 'public', columns: { id: { name: 'id', opclass: 'uuid_ops' } } } },
    })).toEqual({ tables: { users: { columns: { id: { name: 'id' } } } } });
  });

  test('normalizes Drizzle’s composite-unique ordering metadata only after the database contract is checked directly', () => {
    expect(normalizeSnapshot({ nullsNotDistinct: false, columns: ['worker_id', 'job_id'] }))
      .toEqual({ columns: ['job_id', 'worker_id'], nullsNotDistinct: false });
  });

  test('redacts credentials when describing a release database target', () => {
    expect(databaseTarget('postgresql://runtime:secret@db.example:5432/fixly')).toBe('postgresql://db.example:5432/fixly');
  });

  test('requires complete, affirmative release evidence before sign-off', () => {
    const evidence = {
      releaseId: 'release-123', environment: 'staging', recordedAt: '2026-09-01T00:00:00.000Z',
      owners: Object.fromEntries(['applicationRollback', 'databaseRemediation', 'incidentCommunication'].map(key => [key, { name: 'Owner', contact: 'on-call' }])),
      backupRestore: { recoveryPointAt: '2026-09-01T00:00:00.000Z', restoreRehearsedAt: '2026-09-01T00:00:00.000Z', restoreDurationMinutes: 1, rpoMinutes: 0, rtoMinutes: 1, evidenceUrl: 'https://evidence.test/release-123' },
      databaseAccess: { runtimeRoleVerified: true, migrationRoleVerified: true, tlsVerified: true, evidenceUrl: 'https://evidence.test/release-123' },
      migration: { ledgerState: 'tracked', checksumsVerified: true, schemaDriftVerified: true, evidenceUrl: 'https://evidence.test/release-123' },
      compatibility: { previousArtifactSmokePassed: true, correctiveMigrationRehearsed: true, evidenceUrl: 'https://evidence.test/release-123' },
      reconciliation: { marketplaceAuditPassed: true, ratingsCheckPassed: true, evidenceUrl: 'https://evidence.test/release-123' },
      canary: { completedAt: '2026-09-01T00:00:00.000Z', rollbackTested: true, metricsWithinBaseline: true, evidenceUrl: 'https://evidence.test/release-123' },
    };

    expect(parseReleaseEvidence(evidence).releaseId).toBe('release-123');
    expect(() => parseReleaseEvidence({ ...evidence, canary: { ...evidence.canary, rollbackTested: false } })).toThrow('rollbackTested');
    expect(() => parseReleaseEvidence({ ...evidence, releaseId: 'replace-with-release-id' })).toThrow('non-placeholder');
    expect(parseEvidenceArgs(['--file', 'evidence.json'])).toEqual({ file: 'evidence.json' });
  });
});
