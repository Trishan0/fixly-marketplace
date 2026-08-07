/**
 * getOpenJobs.js — Tool: fetch open jobs for the proposal agent.
 * Includes category data and proposal count per job.
 */

const pool = require('../../db');

async function getOpenJobs({ district, categoryId, limit = 30 } = {}) {
  let conditions = [
    "j.status IN ('posted', 'proposals_received')",
    "j.is_active = true",
  ];
  const params = [];
  let idx = 1;

  if (district) {
    conditions.push(`j.district ILIKE $${idx}`);
    params.push(`%${district}%`);
    idx++;
  }

  if (categoryId) {
    conditions.push(`j.category_id = $${idx}`);
    params.push(categoryId);
    idx++;
  }

  const result = await pool.query(
    `SELECT j.*,
            c.name  AS category_name,
            c.icon  AS category_icon,
            (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id AND p.status = 'pending') AS proposal_count
     FROM jobs j
     LEFT JOIN categories c ON c.id = j.category_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE j.urgency
         WHEN 'today'     THEN 1
         WHEN 'tomorrow'  THEN 2
         WHEN 'this_week' THEN 3
         ELSE 4
       END,
       j.created_at DESC
     LIMIT $${idx}`,
    [...params, limit]
  );

  return result.rows;
}

/**
 * Fetch open jobs for a specific worker (excludes jobs they already proposed on).
 */
async function getOpenJobsForWorker(workerId, { limit = 30 } = {}) {
  const result = await pool.query(
    `SELECT j.*,
            c.name  AS category_name,
            c.icon  AS category_icon,
            (SELECT COUNT(*) FROM proposals p2 WHERE p2.job_id = j.id AND p2.status = 'pending') AS proposal_count
     FROM jobs j
     LEFT JOIN categories c ON c.id = j.category_id
     WHERE j.status IN ('posted', 'proposals_received')
       AND j.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM proposals p
         WHERE p.job_id = j.id AND p.worker_id = $1
       )
     ORDER BY
       CASE j.urgency
         WHEN 'today'     THEN 1
         WHEN 'tomorrow'  THEN 2
         WHEN 'this_week' THEN 3
         ELSE 4
       END,
       j.created_at DESC
     LIMIT $2`,
    [workerId, limit]
  );

  return result.rows;
}

module.exports = { getOpenJobs, getOpenJobsForWorker };
