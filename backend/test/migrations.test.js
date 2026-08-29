'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MigrationError,
  discoverMigrations,
  validateMigrationHistory,
} = require('../scripts/lib/migrations');

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function migrationDirectory(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixly-migration-test-'));
  temporaryDirectories.push(directory);
  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, filename), contents);
  }
  return directory;
}

describe('migration discovery and history validation', () => {
  test('discovers only numbered SQL migrations in deterministic order', () => {
    const directory = migrationDirectory({
      '010_last.sql': 'SELECT 10;',
      '002_second.sql': 'SELECT 2;',
      'seed_data.sql': 'SELECT 99;',
      'README.md': 'not sql',
    });

    expect(discoverMigrations(directory).map(item => item.filename)).toEqual([
      '002_second.sql',
      '010_last.sql',
    ]);
  });

  test('rejects a changed applied migration checksum', () => {
    const directory = migrationDirectory({ '001_initial.sql': 'SELECT 1;' });
    const migrations = discoverMigrations(directory);

    expect(() => validateMigrationHistory(migrations, [{
      filename: '001_initial.sql',
      checksum: '0'.repeat(64),
    }])).toThrowError(MigrationError);
  });

  test('rejects a missing applied migration file', () => {
    expect(() => validateMigrationHistory([], [{
      filename: '001_missing.sql',
      checksum: '0'.repeat(64),
    }])).toThrowError(/missing from source/);
  });
});
