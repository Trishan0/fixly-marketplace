/**
 * memory.js — Agent memory layer.
 * Stores and retrieves per-user, per-scope key/value preferences.
 * Uses UPSERT so callers don't need to worry about insert vs update.
 */

const pool = require('../db');

/**
 * Retrieve a memory value.
 * Returns the parsed value_json, or defaultValue if not found.
 */
async function getMemory(userId, scope, key, defaultValue = null) {
  try {
    const result = await pool.query(
      `SELECT value_json FROM agent_memories
       WHERE user_id = $1 AND scope = $2 AND key = $3`,
      [userId, scope, key]
    );
    if (!result.rows[0]) return defaultValue;
    return result.rows[0].value_json;
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
    await pool.query(
      `INSERT INTO agent_memories (user_id, scope, key, value_json, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, scope, key)
       DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
      [userId, scope, key, JSON.stringify(value)]
    );
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
    const result = await pool.query(
      `SELECT key, value_json FROM agent_memories
       WHERE user_id = $1 AND scope = $2`,
      [userId, scope]
    );
    return result.rows.reduce((acc, row) => {
      acc[row.key] = row.value_json;
      return acc;
    }, {});
  } catch (err) {
    console.error('[agent/memory] getAllMemories error:', err.message);
    return {};
  }
}

module.exports = { getMemory, setMemory, getAllMemories };
