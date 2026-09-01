const { z } = require('zod');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  // Compatibility for deployments configured before the Drizzle migration.
  MIGRATION_DATABASE_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).optional(),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).optional(),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).optional(),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).optional(),
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).optional(),
  DATABASE_SLOW_QUERY_MS: z.coerce.number().int().positive().max(600_000).optional(),
  DATABASE_SSL_MODE: z.enum(['disable', 'require', 'verify-full']).optional(),
}).passthrough();

function loadDatabaseConfig(source = process.env) {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid database configuration: ${parsed.error.issues.map(issue => issue.message).join('; ')}`);
  }

  const env = parsed.data;
  const migrationConnectionString = env.DATABASE_MIGRATION_URL || env.MIGRATION_DATABASE_URL;
  if (env.NODE_ENV === 'production') {
    if (!migrationConnectionString) {
      throw new Error('Invalid database configuration: DATABASE_MIGRATION_URL is required in production');
    }
    if (migrationConnectionString === env.DATABASE_URL) {
      throw new Error('Invalid database configuration: runtime and migration database URLs must use separate credentials in production');
    }
    if (env.DATABASE_SSL_MODE !== 'verify-full') {
      throw new Error('Invalid database configuration: DATABASE_SSL_MODE=verify-full is required in production');
    }
  }
  const ssl = env.DATABASE_SSL_MODE === 'disable'
    ? false
    : env.DATABASE_SSL_MODE
      ? { rejectUnauthorized: env.DATABASE_SSL_MODE === 'verify-full' }
      : undefined;

  return {
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX || (env.NODE_ENV === 'production' ? 3 : 10),
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS || 30_000,
    connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT_MS || 10_000,
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS || 30_000,
    idle_in_transaction_session_timeout: env.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS || 30_000,
    slowQueryMs: env.DATABASE_SLOW_QUERY_MS || 500,
    ssl,
    migrationConnectionString: migrationConnectionString || env.DATABASE_URL,
  };
}

module.exports = { loadDatabaseConfig };
