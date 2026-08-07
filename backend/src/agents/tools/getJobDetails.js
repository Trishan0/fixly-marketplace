/**
 * getJobDetails.js — Tool: fetch full job context for the match agent.
 * Queries DB directly (not route handlers) to include category name.
 */

const pool = require('../../db');

async function getJobDetails(jobId) {
  const result = await pool.query(
    `SELECT j.*,
            c.name  AS category_name,
            c.icon  AS category_icon
     FROM jobs j
     LEFT JOIN categories c ON c.id = j.category_id
     WHERE j.id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

module.exports = { getJobDetails };
