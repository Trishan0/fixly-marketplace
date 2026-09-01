/**
 * memory.js — Agent memory layer.
 * Stores and retrieves per-user, per-scope key/value preferences.
 * Uses UPSERT so callers don't need to worry about insert vs update.
 */

const repository = require('../modules/agents/repository');

/**
 * Retrieve a memory value.
 * Returns the parsed value_json, or defaultValue if not found.
 */
async function getMemory(userId, scope, key, defaultValue = null) {
  try {
    const result = await repository.memory(userId, scope, key);
    return result ? result.value_json : defaultValue;
  } catch (err) {
    console.error('[agent/memory] getMemory error:', err.message);
    return defaultValue;
  }
}

/**
 * Store (upsert) a memory value.
 * value will be JSON-serialized automatically by pg.
 */
async function setMemory(userId, scope, key, value) {
  try {
    await repository.upsertMemory(userId, scope, key, value);
  } catch (err) {
    console.error('[agent/memory] setMemory error:', err.message);
  }
}

/**
 * Get all memories for a user within a scope.
 * Returns an object { key: value, ... }
 */
async function getAllMemories(userId, scope) {
  try {
    const result = await repository.memories(userId, scope);
    return result.reduce((acc, row) => {
      acc[row.key] = row.value_json;
      return acc;
    }, {});
  } catch (err) {
    console.error('[agent/memory] getAllMemories error:', err.message);
    return {};
  }
}

module.exports = { getMemory, setMemory, getAllMemories };
