const express = require('express');
const router = express.Router();
const pool = require('../db');
const { maskPhone } = require('../services/contactReveal');

// GET /api/workers
router.get('/', async (req, res) => {
  const { category, district, min_rating, verified, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let conditions = ["u.role = 'worker'", "u.is_suspended = false"];
  let params = [];
  let idx = 1;

  if (category) {
    conditions.push(`EXISTS (
      SELECT 1 FROM worker_skills ws2 
      JOIN categories c2 ON c2.id = ws2.category_id 
      WHERE ws2.worker_id = wp.id AND c2.name ILIKE $${idx}
    )`);
    params.push(`%${category}%`);
    idx++;
  }

  if (district) {
    conditions.push(`u.district ILIKE $${idx}`);
    params.push(`%${district}%`);
    idx++;
  }

  if (min_rating) {
    conditions.push(`wp.avg_rating >= $${idx}`);
    params.push(parseFloat(min_rating));
    idx++;
  }

  if (verified === 'true') {
    conditions.push(`u.is_nic_verified = true`);
  }

  if (search) {
    conditions.push(`(u.full_name ILIKE $${idx} OR wp.primary_skill ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.district, u.area, u.profile_photo,
              u.is_nic_verified, u.created_at,
              wp.primary_skill, wp.starting_price, wp.total_jobs_done, wp.avg_rating, wp.bio
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       ${where}
       ORDER BY wp.avg_rating DESC NULLS LAST, wp.total_jobs_done DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, parseInt(limit), offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id ${where}`,
      params
    );

    res.json({
      workers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/workers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.district, u.area, u.profile_photo,
              u.is_nic_verified, u.phone, u.created_at,
              wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'worker' AND u.is_suspended = false`,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Worker not found' });

    const worker = { ...result.rows[0], phone: maskPhone(result.rows[0].phone) };

    const photos = await pool.query(
      `SELECT id, path, order_idx FROM worker_portfolio_photos
       WHERE worker_id = (SELECT id FROM worker_profiles WHERE user_id = $1)
       ORDER BY order_idx`,
      [req.params.id]
    );

    const skills = await pool.query(
      `SELECT c.id, c.name, c.icon, ws.is_primary
       FROM worker_skills ws
       JOIN categories c ON c.id = ws.category_id
       WHERE ws.worker_id = (SELECT id FROM worker_profiles WHERE user_id = $1)`,
      [req.params.id]
    );

    worker.portfolio_photos = photos.rows;
    worker.skills = skills.rows;

    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/workers/:id/reviews
router.get('/:id/reviews', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    const result = await pool.query(
      `SELECT r.id, r.rating, r.feedback, r.created_at,
              u.full_name as customer_name, u.profile_photo as customer_photo,
              j.title as job_title
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       JOIN jobs j ON j.id = r.job_id
       WHERE r.worker_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), offset]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
