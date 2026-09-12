'use strict';

const { getCached, setCached, clearCache } = require('../src/agents/cache');

describe('cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns undefined for a key that was never set', () => {
    expect(getCached('missing')).toBeUndefined();
  });

  test('returns the value while within the TTL', () => {
    setCached('district:Colombo', ['worker-a'], 1000);
    expect(getCached('district:Colombo')).toEqual(['worker-a']);
  });

  test('expires after the TTL elapses', () => {
    setCached('district:Colombo', ['worker-a'], 1000);
    vi.advanceTimersByTime(1001);
    expect(getCached('district:Colombo')).toBeUndefined();
  });

  test('uses the default TTL when none is given', () => {
    setCached('district:Kandy', ['worker-b']);
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(getCached('district:Kandy')).toEqual(['worker-b']);
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(getCached('district:Kandy')).toBeUndefined();
  });

  test('clearCache empties every entry', () => {
    setCached('a', 1, 10_000);
    setCached('b', 2, 10_000);
    clearCache();
    expect(getCached('a')).toBeUndefined();
    expect(getCached('b')).toBeUndefined();
  });
});
