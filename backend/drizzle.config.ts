import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_MIGRATION_URL
  ?? process.env.MIGRATION_DATABASE_URL
  ?? process.env.DATABASE_URL;

if (!url) throw new Error('DATABASE_MIGRATION_URL (or DATABASE_URL) is required for Drizzle introspection');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './.drizzle',
  dbCredentials: { url },
});
