/**
 * cache.js — a tiny in-process TTL cache.
 *
 * Every match run previously re-fetched and re-scored the entire eligible
 * pool from scratch, even for two customers posting near-identical jobs in
 * the same district minutes apart. This caches the raw candidate pool
 * (before per-job scoring, which stays cheap and always fresh) so repeat
 * district lookups within the TTL skip the DB round-trip.
 *
 * Per-process only - it does not coordinate across server instances (see
 * modules/agents/repository.js's claimPendingRun for the cross-instance
 * concurrency concern). A short TTL keeps staleness bounded; this is a
 * deliberate freshness-for-cost tradeoff, not a correctness guarantee.
 */

'use strict';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const store = new Map();

function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Test-only escape hatch. */
function clearCache() {
  store.clear();
}

module.exports = { getCached, setCached, clearCache, DEFAULT_TTL_MS };
