'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { main, shouldMigrate } = require('../scripts/vercel-build');
const { latestBundledMigration } = require('../src/db/health');

const silent = { log: () => {} };
const PRODUCTION = {
  VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://app:secret@db.example.test/fixly',
  DATABASE_MIGRATION_URL: 'postgresql://owner:secret@db-direct.example.test/fixly',
  DATABASE_SSL_MODE: 'verify-full',
};

describe('vercel-build', () => {
  test('migrates production deploys only, unless explicitly enabled', () => {
    expect(shouldMigrate({ VERCEL_ENV: 'production' })).toBe(true);
    expect(shouldMigrate({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(shouldMigrate({})).toBe(false);
    expect(shouldMigrate({ VERCEL_ENV: 'preview', MIGRATE_ON_BUILD: 'true' })).toBe(true);
  });

  test('builds without touching the database on preview deploys', async () => {
    const compile = vi.fn();
    const migrate = vi.fn();
    const result = await main({ env: { VERCEL_ENV: 'preview' }, compile, migrate, logger: silent });
    expect(compile).toHaveBeenCalledOnce();
    expect(migrate).not.toHaveBeenCalled();
    expect(result.migrated).toBe(false);
  });

  test('applies pending migrations with the migration credentials on production deploys', async () => {
    const migrate = vi.fn().mockResolvedValue({ applied: ['017_messaging_timeline_moderation.sql'] });
    const result = await main({ env: PRODUCTION, compile: () => {}, migrate, logger: silent });
    expect(migrate).toHaveBeenCalledWith(expect.objectContaining({ connectionString: PRODUCTION.DATABASE_MIGRATION_URL }));
    expect(result).toEqual({ migrated: true, applied: ['017_messaging_timeline_moderation.sql'] });
  });

  test('fails the production build when no migration URL is configured', async () => {
    const migrate = vi.fn();
    const env = { ...PRODUCTION };
    delete env.DATABASE_MIGRATION_URL;
    await expect(main({ env, compile: () => {}, migrate, logger: silent })).rejects.toThrow(/DATABASE_MIGRATION_URL is not set/);
    expect(migrate).not.toHaveBeenCalled();
  });

  test('fails the production build when a migration fails', async () => {
    const migrate = vi.fn().mockRejectedValue(new Error('column already exists'));
    await expect(main({ env: PRODUCTION, compile: () => {}, migrate, logger: silent })).rejects.toThrow('column already exists');
  });
});

describe('latestBundledMigration', () => {
  test('returns the newest numbered migration shipped with the code', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixly-latest-migration-'));
    for (const name of ['002_b.sql', '010_c.sql', '001_a.sql', 'seed_demo.sql']) fs.writeFileSync(path.join(directory, name), '');
    expect(latestBundledMigration(directory)).toBe('010_c.sql');
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('returns null when the migration files are not bundled', () => {
    expect(latestBundledMigration(path.join(os.tmpdir(), 'fixly-no-such-directory'))).toBeNull();
  });
});
