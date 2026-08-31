'use strict';

const jwt = require('jsonwebtoken');

const PASSWORD_HASH = '$2a$12$Jh4raQ4HmHkKQ00BJqEv3ePofwcGgrE5m8cYbIRLFBglKnqRJ33P6';

function authorizationFor(user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return `Bearer ${token}`;
}

async function categoryId(pool, name = 'Plumbing') {
  const result = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (!result.rows[0]) throw new Error(`Missing seeded category: ${name}`);
  return result.rows[0].id;
}

async function createUser(pool, {
  email,
  fullName,
  role,
  district = 'Colombo',
  isEmailVerified = true,
  forceVerified = false,
  primarySkill = null,
} = {}) {
  if (!email || !fullName || !role) throw new Error('email, fullName, and role are required');

  const result = await pool.query(
    `INSERT INTO users (
      email, password_hash, full_name, role, district, is_email_verified, force_verified
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, email, full_name, role, district, is_email_verified, force_verified`,
    [email, PASSWORD_HASH, fullName, role, district, isEmailVerified, forceVerified]
  );
  const user = result.rows[0];

  if (role === 'worker') {
    const profile = await pool.query(
      `INSERT INTO worker_profiles (user_id, primary_skill)
       VALUES ($1, $2) RETURNING id`,
      [user.id, primarySkill]
    );
    user.worker_profile_id = profile.rows[0].id;
  }

  return user;
}

async function createJob(pool, {
  customerId,
  categoryId: requestedCategoryId,
  title = 'Repair a leaking kitchen pipe',
  description = 'Water is leaking under the sink.',
  district = 'Colombo',
  status = 'posted',
} = {}) {
  const resolvedCategoryId = requestedCategoryId || await categoryId(pool);
  const result = await pool.query(
    `INSERT INTO jobs (customer_id, title, description, category_id, district, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [customerId, title, description, resolvedCategoryId, district, status]
  );
  return result.rows[0];
}

async function createProposal(pool, { jobId, workerId, price = '5000.00' } = {}) {
  const result = await pool.query(
    `INSERT INTO proposals (job_id, worker_id, proposed_price, message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [jobId, workerId, price, 'I can complete this repair safely.']
  );
  return result.rows[0];
}

module.exports = {
  authorizationFor,
  categoryId,
  createJob,
  createProposal,
  createUser,
};
