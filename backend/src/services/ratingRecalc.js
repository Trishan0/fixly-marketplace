const pool = require('../db');

const recalcRating = async (workerId) => {
  await pool.query(
    `UPDATE worker_profiles 
     SET avg_rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE worker_id = $1), 0),
         total_jobs_done = (SELECT COUNT(*) FROM jobs WHERE assigned_worker_id = $1 AND status IN ('completed','payment_recorded','reviewed'))
     WHERE user_id = $1`,
    [workerId]
  );
};

module.exports = { recalcRating };
