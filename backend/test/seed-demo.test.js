'use strict';

const { requireSeedPermission } = require('../scripts/seed-demo');

describe('production demo seed guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowDemoSeed = process.env.ALLOW_DEMO_SEED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowDemoSeed === undefined) delete process.env.ALLOW_DEMO_SEED;
    else process.env.ALLOW_DEMO_SEED = originalAllowDemoSeed;
  });

  test('refuses an accidental production seed', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_SEED;
    expect(() => requireSeedPermission()).toThrow(/Refusing to seed production/);
  });

  test('allows an explicitly confirmed production seed', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_SEED = 'true';
    expect(() => requireSeedPermission()).not.toThrow();
  });
});
