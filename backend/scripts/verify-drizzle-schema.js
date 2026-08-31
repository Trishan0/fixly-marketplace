'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { inspectMigrations } = require('./lib/migrations');

const backendRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(backendRoot, 'src/db/schema.ts');
const drizzleKitBin = path.join(backendRoot, 'node_modules/drizzle-kit/bin.cjs');
const COMPOSITE_UNIQUE_CONSTRAINTS = Object.freeze([
  { name: 'agent_memories_user_id_scope_key_key', columns: ['user_id', 'scope', 'key'] },
  { name: 'invites_job_id_worker_id_key', columns: ['job_id', 'worker_id'] },
  { name: 'proposals_job_id_worker_id_key', columns: ['job_id', 'worker_id'] },
]);

function requireTestDatabaseUrl() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required for schema verification');

  const databaseName = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
  if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error(`Refusing schema verification against a non-test database: ${databaseName}`);
  }
  return connectionString;
}

function normalizeSnapshot(value, isRoot = true) {
  if (Array.isArray(value)) return value.map(child => normalizeSnapshot(child, false));
  if (!value || typeof value !== 'object') return value;

  const ignoredKeys = new Set(['internal', 'schemaTo', 'opclass']);
  if (isRoot) {
    ignoredKeys.add('id');
    ignoredKeys.add('prevId');
  }

  const normalized = Object.fromEntries(Object.entries(value)
    // These are generator metadata rather than PostgreSQL schema properties.
    .filter(([key]) => !ignoredKeys.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalizeSnapshot(child, false)]));

  // drizzle-kit 0.31.x does not preserve the source order of composite
  // unique-constraint columns when it introspects PostgreSQL. Ordering is
  // therefore checked directly below; sorting here prevents tool metadata
  // from creating a false drift signal.
  if ('nullsNotDistinct' in normalized && Array.isArray(normalized.columns)) {
    normalized.columns = [...normalized.columns].sort();
  }
  return normalized;
}

function readSnapshot(directory) {
  return normalizeSnapshot(JSON.parse(fs.readFileSync(path.join(directory, 'meta/0000_snapshot.json'), 'utf8')));
}

function assertSameSnapshot(expected, actual) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      'Drizzle schema drift detected. Update the numbered SQL migration and checked-in Drizzle contract together; do not use drizzle-kit push.'
    );
  }
}

async function verifyCompositeUniqueConstraintOrder(connectionString) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query(`
      SELECT c.conname,
             array_to_string(array_agg(a.attname ORDER BY key_columns.ordinality), ',') AS column_names
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS key_columns(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key_columns.attnum
      WHERE c.contype = 'u' AND c.conname = ANY($1::text[])
      GROUP BY c.conname
    `, [COMPOSITE_UNIQUE_CONSTRAINTS.map(constraint => constraint.name)]);
    const actual = new Map(result.rows.map(row => [row.conname, row.column_names]));

    for (const expected of COMPOSITE_UNIQUE_CONSTRAINTS) {
      const columns = actual.get(expected.name);
      if (columns !== expected.columns.join(',')) {
        throw new Error(`Composite unique constraint drift: ${expected.name} must be (${expected.columns.join(', ')})`);
      }
    }
  } finally {
    await pool.end();
  }
}

async function verifyDrizzleSchema() {
  const connectionString = requireTestDatabaseUrl();
  const migrationStatus = await inspectMigrations({ connectionString });
  if (migrationStatus.state !== 'tracked' || migrationStatus.pending.length > 0) {
    throw new Error('Schema verification requires a fully migrated database with tracked numbered migrations');
  }

  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixly-drizzle-schema-'));
  const declaredDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixly-drizzle-declared-'));
  try {
    execFileSync(process.execPath, [
      drizzleKitBin,
      'introspect',
      '--dialect', 'postgresql',
      '--out', outputDirectory,
      '--url', connectionString,
    ], { cwd: backendRoot, stdio: 'pipe' });

    execFileSync(process.execPath, [
      drizzleKitBin,
      'generate',
      '--dialect', 'postgresql',
      '--schema', schemaPath,
      '--out', declaredDirectory,
      '--name', 'schema_contract',
    ], { cwd: backendRoot, stdio: 'pipe' });

    assertSameSnapshot(readSnapshot(declaredDirectory), readSnapshot(outputDirectory));
    await verifyCompositeUniqueConstraintOrder(connectionString);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
    fs.rmSync(declaredDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  verifyDrizzleSchema()
    .then(() => console.info('Drizzle schema matches the numbered-migration database'))
    .catch(error => {
      console.error(`Drizzle schema verification failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  COMPOSITE_UNIQUE_CONSTRAINTS,
  normalizeSnapshot,
  requireTestDatabaseUrl,
  verifyCompositeUniqueConstraintOrder,
  verifyDrizzleSchema,
};
