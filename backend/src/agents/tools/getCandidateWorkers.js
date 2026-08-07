/**
 * getCandidateWorkers.js — Tool: fetch all eligible workers WITH their skills.
 *
 * This fixes the bulk-skills gap identified in the plan review.
 * The public /api/workers route doesn't return skills, so we query the DB
 * directly and join worker_skills in a single efficient query.
 */

const pool = require('../../db');

async function getCandidateWorkers({ categoryId, district, limit = 50 } = {}) {
  // Step 1: fetch workers (optionally pre-filtered for speed)
  let conditions = ["u.role = 'worker'", "u.is_suspended = false"];
  const params = [];
  let idx = 1;

  if (district) {
    conditions.push(`u.district ILIKE $${idx}`);
    params.push(`%${district}%`);
    idx++;
  }

  const workerResult = await pool.query(
    `SELECT u.id, u.full_name, u.district, u.area, u.profile_photo,
            u.is_nic_verified, u.phone,
            wp.id AS worker_profile_id,
            wp.bio, wp.starting_price, wp.primary_skill,
            wp.total_jobs_done, wp.avg_rating
     FROM users u
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY wp.avg_rating DESC NULLS LAST, wp.total_jobs_done DESC
     LIMIT $${idx}`,
    [...params, limit]
  );

  const workers = workerResult.rows;
  if (workers.length === 0) return [];

  // Step 2: batch-fetch all skills for these workers in one query
  const profileIds = workers
    .map(w => w.worker_profile_id)
    .filter(Boolean);

  let skillsByProfileId = {};

  if (profileIds.length > 0) {
    const skillResult = await pool.query(
      `SELECT ws.worker_id AS profile_id, ws.category_id, ws.is_primary,
              c.name AS category_name, c.icon AS category_icon
       FROM worker_skills ws
       JOIN categories c ON c.id = ws.category_id
       WHERE ws.worker_id = ANY($1::uuid[])`,
      [profileIds]
    );

    skillResult.rows.forEach(row => {
      if (!skillsByProfileId[row.profile_id]) skillsByProfileId[row.profile_id] = [];
      skillsByProfileId[row.profile_id].push({
        category_id:   row.category_id,
        category_name: row.category_name,
        category_icon: row.category_icon,
        is_primary:    row.is_primary,
      });
    });
  }

  // Step 3: attach skills to each worker
  return workers.map(w => ({
    ...w,
    skills: skillsByProfileId[w.worker_profile_id] || [],
  }));
}

module.exports = { getCandidateWorkers };
