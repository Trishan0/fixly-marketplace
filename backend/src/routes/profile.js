const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/profile/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.district, u.area,
              u.profile_photo, u.is_email_verified, u.force_verified, u.is_nic_verified,
              u.nic_image_path, u.dashboard_mode, u.created_at,
              wp.id as worker_profile_id, wp.bio, wp.starting_price, wp.primary_skill,
              wp.total_jobs_done, wp.avg_rating
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    
    if (req.user.role === 'worker') {
      const photos = await pool.query(
        `SELECT id, path, order_idx FROM worker_portfolio_photos
         WHERE worker_id = (SELECT id FROM worker_profiles WHERE user_id = $1)
         ORDER BY order_idx`,
        [req.user.id]
      );
      const skills = await pool.query(
        `SELECT ws.id, ws.is_primary, c.id as category_id, c.name as category_name
         FROM worker_skills ws
         JOIN categories c ON c.id = ws.category_id
         WHERE ws.worker_id = (SELECT id FROM worker_profiles WHERE user_id = $1)`,
        [req.user.id]
      );
      user.portfolio_photos = photos.rows;
      user.skills = skills.rows;
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/profile/me
router.put('/me', verifyToken, async (req, res) => {
  const { full_name, phone, district, area, bio, starting_price, primary_skill } = req.body;
  try {
    await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone),
       district = COALESCE($3, district), area = COALESCE($4, area), updated_at = NOW()
       WHERE id = $5`,
      [full_name, phone, district, area, req.user.id]
    );

    if (req.user.role === 'worker') {
      await pool.query(
        `UPDATE worker_profiles SET bio = COALESCE($1, bio),
         starting_price = COALESCE($2, starting_price),
         primary_skill = COALESCE($3, primary_skill)
         WHERE user_id = $4`,
        [bio, starting_price, primary_skill, req.user.id]
      );
    }

    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/profile/photo
router.post('/photo', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const path = `/uploads/${req.file.filename}`;
  await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [path, req.user.id]);
  res.json({ path });
});

// POST /api/profile/nic-upload
router.post('/nic-upload', verifyToken, upload.single('nic_image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const path = `/uploads/${req.file.filename}`;
  await pool.query('UPDATE users SET nic_image_path = $1 WHERE id = $2', [path, req.user.id]);
  res.json({ message: 'NIC uploaded, pending verification', path });
});

// PUT /api/profile/dashboard-mode
router.put('/dashboard-mode', verifyToken, requireRole('worker'), async (req, res) => {
  const { mode } = req.body;
  if (!['standard', 'simplified'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  await pool.query('UPDATE users SET dashboard_mode = $1 WHERE id = $2', [mode, req.user.id]);
  res.json({ message: 'Dashboard mode updated', mode });
});

// POST /api/profile/portfolio
router.post('/portfolio', verifyToken, requireRole('worker'), upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const wpResult = await pool.query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id]);
  if (!wpResult.rows[0]) return res.status(404).json({ error: 'Worker profile not found' });
  
  const count = await pool.query('SELECT COUNT(*) FROM worker_portfolio_photos WHERE worker_id = $1', [wpResult.rows[0].id]);
  if (parseInt(count.rows[0].count) >= 10) {
    return res.status(400).json({ error: 'Maximum 10 portfolio photos allowed' });
  }
  
  const path = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    'INSERT INTO worker_portfolio_photos (worker_id, path) VALUES ($1, $2) RETURNING *',
    [wpResult.rows[0].id, path]
  );
  res.json(result.rows[0]);
});

// DELETE /api/profile/portfolio/:photoId
router.delete('/portfolio/:photoId', verifyToken, requireRole('worker'), async (req, res) => {
  const wpResult = await pool.query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id]);
  if (!wpResult.rows[0]) return res.status(404).json({ error: 'Not found' });
  
  await pool.query(
    'DELETE FROM worker_portfolio_photos WHERE id = $1 AND worker_id = $2',
    [req.params.photoId, wpResult.rows[0].id]
  );
  res.json({ message: 'Photo deleted' });
});

module.exports = router;
