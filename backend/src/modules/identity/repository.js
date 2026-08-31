const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');

function executor(client = db) { return client; }
async function rows(statement, client) { return (await executor(client).execute(statement)).rows; }
async function one(statement, client) { return (await rows(statement, client))[0] || null; }

function findSessionUser(userId) {
  return one(sql`
    SELECT id, email, role, full_name, is_suspended, is_email_verified, force_verified, dashboard_mode
    FROM users WHERE id = ${userId}
  `);
}

function findAuthUserByEmail(email) {
  return one(sql`
    SELECT id, email, password_hash, role, full_name, is_suspended, is_email_verified,
           force_verified, dashboard_mode, profile_photo, district
    FROM users WHERE LOWER(email) = LOWER(${email})
  `);
}

function insertUser(input, client) {
  return one(sql`
    INSERT INTO users (
      full_name, email, password_hash, phone, role, district, area,
      email_verify_token_hash, email_verify_expires_at, dashboard_mode
    ) VALUES (
      ${input.fullName}, ${input.email}, ${input.passwordHash}, ${input.phone}, ${input.role},
      ${input.district}, ${input.area}, ${input.verifyTokenHash}, ${input.verifyExpiresAt}, ${input.dashboardMode}
    )
    RETURNING id, email, role, full_name, is_email_verified, force_verified, dashboard_mode
  `, client);
}

function createWorkerProfile(userId, primarySkill, client) {
  return one(sql`
    INSERT INTO worker_profiles (user_id, primary_skill) VALUES (${userId}, ${primarySkill}) RETURNING id
  `, client);
}

function findCategoryByName(name, client) {
  return one(sql`SELECT id FROM categories WHERE LOWER(name) = LOWER(${name})`, client);
}

function insertWorkerSkill(workerId, categoryId, client) {
  return one(sql`
    INSERT INTO worker_skills (worker_id, category_id, is_primary)
    VALUES (${workerId}, ${categoryId}, true)
    ON CONFLICT (worker_id, category_id) DO NOTHING RETURNING id
  `, client);
}

function verifyEmail(tokenHash) {
  return one(sql`
    UPDATE users SET is_email_verified = true, email_verify_token_hash = NULL,
      email_verify_expires_at = NULL, updated_at = NOW()
    WHERE email_verify_token_hash = ${tokenHash} AND email_verify_expires_at > NOW()
      AND is_email_verified = false
    RETURNING id
  `);
}

function findResetEligibleUser(email) {
  return one(sql`SELECT id, is_suspended FROM users WHERE LOWER(email) = LOWER(${email})`);
}

function setPasswordResetToken(email, tokenHash, expiresAt) {
  return one(sql`
    UPDATE users SET password_reset_token_hash = ${tokenHash}, password_reset_expires_at = ${expiresAt}, updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email}) RETURNING id
  `);
}

function resetPassword(tokenHash, passwordHash) {
  return one(sql`
    UPDATE users SET password_hash = ${passwordHash}, password_reset_token_hash = NULL,
      password_reset_expires_at = NULL, updated_at = NOW()
    WHERE password_reset_token_hash = ${tokenHash} AND password_reset_expires_at > NOW()
    RETURNING id
  `);
}

function selfProfile(userId) {
  return one(sql`
    SELECT u.id, u.email, u.full_name, u.role, u.phone, u.district, u.area, u.profile_photo,
      u.is_email_verified, u.force_verified, u.is_nic_verified, u.dashboard_mode, u.created_at,
      wp.id AS worker_profile_id, wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating
    FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.id = ${userId}
  `);
}

function workerProfileId(userId, client) { return one(sql`SELECT id FROM worker_profiles WHERE user_id = ${userId} FOR UPDATE`, client); }
function workerPortfolio(workerProfileId) { return rows(sql`SELECT id, path, order_idx FROM worker_portfolio_photos WHERE worker_id = ${workerProfileId} ORDER BY order_idx`); }
function workerSkills(userId) { return rows(sql`
  SELECT ws.id, ws.is_primary, c.id AS category_id, c.name AS category_name
  FROM worker_skills ws JOIN categories c ON c.id = ws.category_id
  WHERE ws.worker_id = (SELECT id FROM worker_profiles WHERE user_id = ${userId}) ORDER BY c.name
`); }

function updateProfile(input, client) {
  return one(sql`
    UPDATE users SET full_name = COALESCE(${input.fullName}, full_name), phone = COALESCE(${input.phone}, phone),
      district = COALESCE(${input.district}, district), area = COALESCE(${input.area}, area), updated_at = NOW()
    WHERE id = ${input.userId} RETURNING id
  `, client);
}
function updateWorkerProfile(input, client) {
  return one(sql`
    UPDATE worker_profiles SET bio = COALESCE(${input.bio}, bio), starting_price = COALESCE(${input.startingPrice}, starting_price),
      primary_skill = COALESCE(${input.primarySkill}, primary_skill) WHERE user_id = ${input.userId} RETURNING id
  `, client);
}
function setProfilePhoto(userId, path) { return one(sql`UPDATE users SET profile_photo = ${path}, updated_at = NOW() WHERE id = ${userId} RETURNING profile_photo`); }
function setNicImage(userId, path) { return one(sql`UPDATE users SET nic_image_path = ${path}, is_nic_verified = false, nic_verified_by = NULL, updated_at = NOW() WHERE id = ${userId} RETURNING nic_image_path`); }
function setDashboardMode(userId, mode) { return one(sql`UPDATE users SET dashboard_mode = ${mode}, updated_at = NOW() WHERE id = ${userId} RETURNING dashboard_mode`); }
function portfolioCount(workerId, client) { return one(sql`SELECT COUNT(*)::int AS count FROM worker_portfolio_photos WHERE worker_id = ${workerId}`, client); }
function insertPortfolioPhoto(workerId, path, client) { return one(sql`INSERT INTO worker_portfolio_photos (worker_id, path) VALUES (${workerId}, ${path}) RETURNING *`, client); }
function deletePortfolioPhoto(photoId, workerId, client) { return one(sql`DELETE FROM worker_portfolio_photos WHERE id = ${photoId} AND worker_id = ${workerId} RETURNING path`, client); }
function listWorkers({ category, district, minRating, verified, search, limit, offset }) { return rows(sql`
  SELECT u.id, u.full_name, u.district, u.area, u.profile_photo, u.is_nic_verified, u.created_at,
    wp.primary_skill, wp.starting_price, wp.total_jobs_done, wp.avg_rating, wp.bio
  FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
  WHERE u.role = 'worker' AND u.is_suspended = false
    AND (${category}::text IS NULL OR EXISTS (SELECT 1 FROM worker_skills ws JOIN categories c ON c.id = ws.category_id WHERE ws.worker_id = wp.id AND c.name ILIKE ${`%${category || ''}%`}))
    AND (${district}::text IS NULL OR u.district ILIKE ${`%${district || ''}%`})
    AND (${minRating}::numeric IS NULL OR wp.avg_rating >= ${minRating})
    AND (${verified}::boolean = false OR u.is_nic_verified = true)
    AND (${search}::text IS NULL OR u.full_name ILIKE ${`%${search || ''}%`} OR wp.primary_skill ILIKE ${`%${search || ''}%`})
  ORDER BY wp.avg_rating DESC NULLS LAST, wp.total_jobs_done DESC LIMIT ${limit} OFFSET ${offset}
`); }
function countWorkers({ category, district, minRating, verified, search }) { return one(sql`
  SELECT COUNT(*)::int AS count FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
  WHERE u.role = 'worker' AND u.is_suspended = false
    AND (${category}::text IS NULL OR EXISTS (SELECT 1 FROM worker_skills ws JOIN categories c ON c.id = ws.category_id WHERE ws.worker_id = wp.id AND c.name ILIKE ${`%${category || ''}%`}))
    AND (${district}::text IS NULL OR u.district ILIKE ${`%${district || ''}%`}) AND (${minRating}::numeric IS NULL OR wp.avg_rating >= ${minRating})
    AND (${verified}::boolean = false OR u.is_nic_verified = true) AND (${search}::text IS NULL OR u.full_name ILIKE ${`%${search || ''}%`} OR wp.primary_skill ILIKE ${`%${search || ''}%`})
`); }
function publicWorker(id) { return one(sql`SELECT u.id, u.full_name, u.district, u.area, u.profile_photo, u.is_nic_verified, u.phone, u.created_at, wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=${id} AND u.role='worker' AND u.is_suspended=false`); }
function workerReviews(id, limit, offset) { return rows(sql`SELECT r.id,r.rating,r.feedback,r.created_at,u.full_name AS customer_name,u.profile_photo AS customer_photo,j.title AS job_title FROM reviews r JOIN users u ON u.id=r.customer_id JOIN jobs j ON j.id=r.job_id WHERE r.worker_id=${id} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`); }
function customerSummary(id) { return one(sql`SELECT u.id,u.full_name,u.district,u.area,u.profile_photo,u.created_at, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id) AS jobs_posted, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id AND status IN ('posted','proposals_received','assigned','in_progress')) AS active_jobs, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id AND status IN ('completed','payment_recorded','reviewed')) AS jobs_completed, (SELECT COUNT(*)::int FROM reviews WHERE customer_id=u.id) AS reviews_given FROM users u WHERE u.id=${id} AND u.role='customer' AND u.is_suspended=false`); }
function customerRecentJobs(id) { return rows(sql`SELECT j.id,j.title,j.status,j.created_at,c.name AS category_name,(SELECT COUNT(*)::int FROM proposals p WHERE p.job_id=j.id) AS proposal_count FROM jobs j LEFT JOIN categories c ON c.id=j.category_id WHERE j.customer_id=${id} ORDER BY j.created_at DESC LIMIT 4`); }

module.exports = {
  createWorkerProfile, deletePortfolioPhoto, findAuthUserByEmail, findCategoryByName, findResetEligibleUser,
  findSessionUser, insertPortfolioPhoto, insertUser, insertWorkerSkill, portfolioCount, resetPassword,
  selfProfile, setDashboardMode, setNicImage, setPasswordResetToken, setProfilePhoto, updateProfile,
  updateWorkerProfile, verifyEmail, workerPortfolio, workerProfileId, workerSkills,
  countWorkers, customerRecentJobs, customerSummary, listWorkers, publicWorker, workerReviews,
};
