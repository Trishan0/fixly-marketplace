'use strict';

// getWorkerReviews() itself just delegates to the repository (a DB call),
// so it isn't unit-testable without a live database or module mocking -
// require() doesn't route through Vitest's mock registry for local files
// in this project's CommonJS setup (see agents-gemini.test.js). The only
// pure logic worth covering here is the limit normalization.
const { normalizedLimit } = require('../src/agents/tools/getWorkerReviews');

describe('getWorkerReviews normalizedLimit', () => {
  test('defaults to 25 when no limit is given', () => {
    expect(normalizedLimit(undefined)).toBe(25);
  });

  test('passes through a valid limit within range', () => {
    expect(normalizedLimit(10)).toBe(10);
  });

  test('clamps an excessive limit to the cap of 50', () => {
    expect(normalizedLimit(500)).toBe(50);
  });

  test('clamps a negative limit up to 1', () => {
    expect(normalizedLimit(-5)).toBe(1);
  });

  test('falls back to the default for a non-numeric limit', () => {
    expect(normalizedLimit('lots')).toBe(25);
  });
});
