const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { createRawToken, hashToken, expiresInHours } = require('../services/authTokens');
const { createRateLimiter } = require('../middleware/rateLimit');

const emailSchema = z.string().trim().email().max(255).transform(v => v.toLowerCase());
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(255),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(['customer', 'worker']),
  district: z.string().trim().max(100).optional().nullable(),
  area: z.string().trim().max(100).optional().nullable(),
  primary_skill: z.string().trim().max(100).optional().nullable(),
  dashboard_mode: z.enum(['standard', 'simplified']).optional().default('standard'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().min(16).max(255),
  password: passwordSchema,
});

const authWriteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth-write',
  message: 'Too many authentication attempts, please try again later',
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'forgot-password',
  message: 'Too many reset requests, please try again later',
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function validationError(res, parsed) {
  return res.status(400).json({
    error: parsed.error.issues[0]?.message || 'Invalid request',
  });
}

// POST /api/auth/register
router.post('/register', authWriteLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  const {
    full_name, email, password, phone, role, district, area, primary_skill, dashboard_mode,
  } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const rawVerifyToken = createRawToken();
    const email_verify_token_hash = hashToken(rawVerifyToken);
    const email_verify_expires_at = expiresInHours(24);

    const result = await client.query(
      `INSERT INTO users (
        full_name, email, password_hash, phone, role, district, area,
        email_verify_token_hash, email_verify_expires_at, dashboard_mode
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email, role, full_name, is_email_verified, force_verified, dashboard_mode`,
      [
        full_name,
        email,
        password_hash,
        phone || null,
        role,
        district || null,
        area || null,
        email_verify_token_hash,
        email_verify_expires_at,
        dashboard_mode,
      ]
    );

    const user = result.rows[0];

    if (role === 'worker') {
      const wpResult = await client.query(
        'INSERT INTO worker_profiles (user_id, primary_skill) VALUES ($1, $2) RETURNING id',
        [user.id, primary_skill || null]
      );

      if (primary_skill) {
        const cat = await client.query('SELECT id FROM categories WHERE name ILIKE $1', [primary_skill]);
        if (cat.rows[0]) {
          await client.query(
            'INSERT INTO worker_skills (worker_id, category_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING',
            [wpResult.rows[0].id, cat.rows[0].id]
          );
        }
      }
    }

    await client.query('COMMIT');

    await sendVerificationEmail(email, rawVerifyToken);

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', authWriteLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  const { email, password } = parsed.data;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);

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
  const tokenHash = hashToken(req.params.token);
  try {
    const result = await pool.query(
      `UPDATE users
       SET is_email_verified = true,
           email_verify_token_hash = null,
           email_verify_expires_at = null,
           updated_at = NOW()
       WHERE email_verify_token_hash = $1
         AND email_verify_expires_at > NOW()
         AND is_email_verified = false
       RETURNING id`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  const { email } = parsed.data;
  try {
    const result = await pool.query('SELECT id, is_suspended FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0 || result.rows[0].is_suspended) {
      return res.json({ message: 'If account exists, reset email sent' });
    }

    const rawToken = createRawToken();
    await pool.query(
      `UPDATE users
       SET password_reset_token_hash = $1,
           password_reset_expires_at = $2,
           updated_at = NOW()
       WHERE email = $3`,
      [hashToken(rawToken), expiresInHours(1), email]
    );

    await sendPasswordResetEmail(email, rawToken);
    res.json({ message: 'If account exists, reset email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authWriteLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  const { token, password } = parsed.data;
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token_hash = null,
           password_reset_expires_at = null,
           updated_at = NOW()
       WHERE password_reset_token_hash = $2
         AND password_reset_expires_at > NOW()
       RETURNING id`,
      [password_hash, hashToken(token)]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
