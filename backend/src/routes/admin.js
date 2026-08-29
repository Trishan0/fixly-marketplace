const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

const adminOnly = [verifyToken, requireRole('admin')];

// GET /api/admin/stats
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [users, workers, jobs, reports, openJobs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role != $1', ['admin']),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'worker'"),
      pool.query('SELECT COUNT(*) FROM jobs'),
      pool.query("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
      pool.query("SELECT COUNT(*) FROM jobs WHERE status IN ('posted','proposals_received')"),
    ]);
    res.json({
      total_users: parseInt(users.rows[0].count),
      total_workers: parseInt(workers.rows[0].count),
      total_jobs: parseInt(jobs.rows[0].count),
      open_reports: parseInt(reports.rows[0].count),
      open_jobs: parseInt(openJobs.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/users
router.get('/users', ...adminOnly, async (req, res) => {
  const { role, search, suspended, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];
  let idx = 1;

  if (role) { conditions.push(`u.role = $${idx}`); params.push(role); idx++; }
  if (search) {
    conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }
  if (suspended === 'true') { conditions.push('u.is_suspended = true'); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.district,
              u.is_email_verified, u.is_nic_verified, u.force_verified,
              u.is_suspended, u.created_at,
              wp.avg_rating, wp.total_jobs_done
       FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);
    res.json({ users: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating
       FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/admin/users/:id/force-verify
router.put('/users/:id/force-verify', ...adminOnly, async (req, res) => {
  const { force_verified } = req.body;
  await pool.query('UPDATE users SET force_verified = $1 WHERE id = $2', [force_verified, req.params.id]);
  res.json({ message: 'Updated' });
});

// PUT /api/admin/users/:id/verify-nic
router.put('/users/:id/verify-nic', ...adminOnly, async (req, res) => {
  const { verified } = req.body;
  await pool.query(
    'UPDATE users SET is_nic_verified = $1, nic_verified_by = $2 WHERE id = $3',
    [verified, req.user.id, req.params.id]
  );
  if (verified) {
    await createNotification(req.params.id, 'nic_verified', 'Identity Verified', 'Your NIC has been verified. You now have a verified badge!', {});
  }
  res.json({ message: 'Updated' });
});

// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', ...adminOnly, async (req, res) => {
  const { suspended } = req.body;
  await pool.query('UPDATE users SET is_suspended = $1 WHERE id = $2', [suspended, req.params.id]);
  res.json({ message: 'Updated' });
});

// GET /api/admin/workers (NIC pending queue)
router.get('/workers', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.district, u.nic_image_path,
              u.is_nic_verified, u.force_verified, u.is_suspended, u.created_at,
              wp.primary_skill, wp.avg_rating, wp.total_jobs_done
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.role = 'worker'
       ORDER BY u.is_nic_verified ASC, u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/jobs
router.get('/jobs', ...adminOnly, async (req, res) => {
  const { status, category, district, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let conditions = [], params = [], idx = 1;

  if (status) { conditions.push(`j.status = $${idx}`); params.push(status); idx++; }
  if (category) { conditions.push(`c.name ILIKE $${idx}`); params.push(`%${category}%`); idx++; }
  if (district) { conditions.push(`j.district ILIKE $${idx}`); params.push(`%${district}%`); idx++; }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const result = await pool.query(
      `SELECT j.*, c.name as category_name, u.full_name as customer_name
       FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
       LEFT JOIN users u ON u.id = j.customer_id
       ${where} ORDER BY j.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(
      `SELECT COUNT(*) FROM jobs j LEFT JOIN categories c ON c.id = j.category_id ${where}`, params
    );
    res.json({ jobs: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/admin/jobs/:id/flag
router.put('/jobs/:id/flag', ...adminOnly, async (req, res) => {
  await pool.query('UPDATE jobs SET is_active = false WHERE id = $1', [req.params.id]);
  res.json({ message: 'Job flagged' });
});

// GET /api/admin/reports
router.get('/reports', ...adminOnly, async (req, res) => {
  const { status, type } = req.query;
  let conditions = [], params = [], idx = 1;
  if (status) { conditions.push(`r.status = $${idx}`); params.push(status); idx++; }
  if (type) { conditions.push(`r.report_type = $${idx}`); params.push(type); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const result = await pool.query(
      `SELECT r.*, u1.full_name as reporter_name, u2.full_name as reported_user_name,
              j.title as job_title
       FROM reports r
       LEFT JOIN users u1 ON u1.id = r.reporter_id
       LEFT JOIN users u2 ON u2.id = r.reported_user_id
       LEFT JOIN jobs j ON j.id = r.job_id
       ${where} ORDER BY r.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/admin/reports/:id/resolve
router.put('/reports/:id/resolve', ...adminOnly, async (req, res) => {
  const { status, resolution_note } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reports SET status = $1, resolution_note = $2, resolved_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, resolution_note, req.user.id, req.params.id]
    );
    const report = result.rows[0];
    await createNotification(
      report.reporter_id, 'report_updated', 'Report Updated',
      `Your report has been resolved: ${status}`,
      { report_id: report.id }
    );
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/admin/categories
router.get('/categories', ...adminOnly, async (req, res) => {
  const result = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(result.rows);
});

// POST /api/admin/categories
router.post('/categories', ...adminOnly, async (req, res) => {
  const { name, icon, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = await pool.query(
    'INSERT INTO categories (name, icon, parent_id) VALUES ($1,$2,$3) RETURNING *',
    [name, icon, parent_id || null]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', ...adminOnly, async (req, res) => {
  const { name, icon, is_active } = req.body;
  await pool.query(
    'UPDATE categories SET name = COALESCE($1,name), icon = COALESCE($2,icon), is_active = COALESCE($3,is_active) WHERE id = $4',
    [name, icon, is_active, req.params.id]
  );
  res.json({ message: 'Updated' });
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', ...adminOnly, async (req, res) => {
  await pool.query('UPDATE categories SET is_active = false WHERE id = $1', [req.params.id]);
  res.json({ message: 'Category deactivated' });
});

module.exports = router;
