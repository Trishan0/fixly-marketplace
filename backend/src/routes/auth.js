const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, email, password, phone, role, district, area, primary_skill, dashboard_mode } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['customer', 'worker'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const email_verify_token = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role, district, area, email_verify_token, dashboard_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, email, role, full_name`,
      [full_name, email, password_hash, phone, role, district, area, email_verify_token, dashboard_mode || 'standard']
    );

    const user = result.rows[0];

    // Create worker profile if worker
    if (role === 'worker') {
      const wpResult = await pool.query(
        `INSERT INTO worker_profiles (user_id, primary_skill) VALUES ($1, $2) RETURNING id`,
        [user.id, primary_skill || null]
      );
      // If primary skill matches a category, link it
      if (primary_skill) {
        const cat = await pool.query('SELECT id FROM categories WHERE name ILIKE $1', [primary_skill]);
        if (cat.rows[0]) {
          await pool.query(
            'INSERT INTO worker_skills (worker_id, category_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING',
            [wpResult.rows[0].id, cat.rows[0].id]
          );
        }
      }
    }

    // Send verification email (non-blocking)
    sendVerificationEmail(email, email_verify_token);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        is_email_verified: user.is_email_verified,
        force_verified: user.force_verified,
        dashboard_mode: user.dashboard_mode,
        profile_photo: user.profile_photo,
        district: user.district,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/verify-email/:token
router.post('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await pool.query(
      `UPDATE users SET is_email_verified = true, email_verify_token = null
       WHERE email_verify_token = $1 RETURNING id`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.json({ message: 'If account exists, reset email sent' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE users SET email_verify_token = $1 WHERE email = $2`,
      [token, email]
    );
    sendPasswordResetEmail(email, token);
    res.json({ message: 'If account exists, reset email sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, email_verify_token = null
       WHERE email_verify_token = $2 RETURNING id`,
      [password_hash, token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.district, u.area,
              u.profile_photo, u.is_email_verified, u.force_verified, u.is_nic_verified,
              u.dashboard_mode, u.is_suspended, u.created_at,
              wp.id as worker_profile_id, wp.bio, wp.starting_price, wp.primary_skill,
              wp.total_jobs_done, wp.avg_rating
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
