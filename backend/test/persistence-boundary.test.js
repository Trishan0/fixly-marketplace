'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../src');
const restrictedDirectories = ['agents', 'middleware', 'routes', 'services'];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(location);
    return /\.(?:js|ts)$/.test(entry.name) ? [location] : [];
  });
}

describe('production persistence boundary', () => {
  test('keeps direct pool access out of routes, middleware, services, and agents', () => {
    const violations = restrictedDirectories.flatMap(directory => sourceFiles(path.join(root, directory)))
      .filter(file => /(?:pool\.query|client\.query|\bdb\.execute\(|require\(['"](?:\.\.\/)+(?:db)(?:\/index)?['"]\)|require\(['"]pg['"]\))/.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(root, file));

    expect(violations).toEqual([]);
  });
});
