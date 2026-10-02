const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');
const { instrumentRepository } = require('../../observability/request-context');

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
      email_verify_token_hash, email_verify_expires_at, dashboard_mode, terms_accepted_at
    ) VALUES (
      ${input.fullName}, ${input.email}, ${input.passwordHash}, ${input.phone}, ${input.role},
      ${input.district}, ${input.area}, ${input.verifyTokenHash}, ${input.verifyExpiresAt}, ${input.dashboardMode}, NOW()
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
      CASE WHEN u.is_nic_verified THEN 'verified'
           WHEN u.nic_image_path IS NOT NULL THEN 'pending'
           WHEN u.nic_rejection_reason IS NOT NULL THEN 'rejected'
           ELSE 'none' END AS nic_status,
      u.nic_rejection_reason,
      wp.id AS worker_profile_id, wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating,
      wp.ai_matching_opt_in
    FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.id = ${userId}
  `);
}

function workerProfileId(userId, client) { return one(sql`SELECT id FROM worker_profiles WHERE user_id = ${userId} FOR UPDATE`, client); }
function workerPortfolio(workerProfileId) { return rows(sql`SELECT id, path, order_idx FROM worker_portfolio_photos WHERE worker_id = ${workerProfileId} ORDER BY order_idx LIMIT 20`); }
function workerSkills(userId) { return rows(sql`
  SELECT ws.id, ws.is_primary, c.id AS category_id, c.name AS category_name
  FROM worker_skills ws JOIN categories c ON c.id = ws.category_id
  WHERE ws.worker_id = (SELECT id FROM worker_profiles WHERE user_id = ${userId}) ORDER BY c.name LIMIT 50
`); }

// Partial updates: a field left out (undefined) keeps its value. Drizzle
// drops undefined from SQL entirely, so each one is turned into null for
// COALESCE first.
function updateProfile(input, client) {
  return one(sql`
    UPDATE users SET full_name = COALESCE(${input.fullName ?? null}, full_name), phone = COALESCE(${input.phone ?? null}, phone),
      district = COALESCE(${input.district ?? null}, district), area = COALESCE(${input.area ?? null}, area), updated_at = NOW()
    WHERE id = ${input.userId} RETURNING id
  `, client);
}
// starting_price is optional: null clears it, undefined leaves it alone.
function updateWorkerProfile(input, client) {
  return one(sql`
    UPDATE worker_profiles SET bio = COALESCE(${input.bio ?? null}, bio),
      starting_price = CASE WHEN ${input.startingPrice !== undefined}::boolean THEN ${input.startingPrice ?? null}::varchar ELSE starting_price END,
      primary_skill = COALESCE(${input.primarySkill ?? null}, primary_skill), updated_at = NOW() WHERE user_id = ${input.userId} RETURNING id
  `, client);
}
function setProfilePhoto(userId, path) { return one(sql`WITH touched AS (UPDATE worker_profiles SET updated_at = NOW() WHERE user_id = ${userId}) UPDATE users SET profile_photo = ${path}, updated_at = NOW() WHERE id = ${userId} RETURNING profile_photo`); }
function setNicImage(userId, path) { return one(sql`UPDATE users SET nic_image_path = ${path}, is_nic_verified = false, nic_verified_by = NULL, nic_rejection_reason = NULL, updated_at = NOW() WHERE id = ${userId} RETURNING nic_image_path`); }
function setEmailVerifyToken(userId, tokenHash, expiresAt) {
  return one(sql`
    UPDATE users SET email_verify_token_hash = ${tokenHash}, email_verify_expires_at = ${expiresAt}, updated_at = NOW()
    WHERE id = ${userId} AND is_email_verified = false AND is_suspended = false
    RETURNING id, email
  `);
}
function findVerificationState(userId) { return one(sql`SELECT id, email, is_email_verified, force_verified, is_suspended FROM users WHERE id = ${userId}`); }
function setDashboardMode(userId, mode) { return one(sql`UPDATE users SET dashboard_mode = ${mode}, updated_at = NOW() WHERE id = ${userId} RETURNING dashboard_mode`); }
function setAiMatchingOptIn(userId, optIn) { return one(sql`UPDATE worker_profiles SET ai_matching_opt_in = ${optIn} WHERE user_id = ${userId} RETURNING ai_matching_opt_in`); }
function portfolioCount(workerId, client) { return one(sql`SELECT COUNT(*)::int AS count FROM worker_portfolio_photos WHERE worker_id = ${workerId}`, client); }
function insertPortfolioPhoto(workerId, path, client) { return one(sql`WITH touched AS (UPDATE worker_profiles SET updated_at = NOW() WHERE id = ${workerId}) INSERT INTO worker_portfolio_photos (worker_id, path) VALUES (${workerId}, ${path}) RETURNING *`, client); }
function deletePortfolioPhoto(photoId, workerId, client) { return one(sql`DELETE FROM worker_portfolio_photos WHERE id = ${photoId} AND worker_id = ${workerId} RETURNING path`, client); }
// Catalog sorts, whitelisted (the client sends a name, never SQL). Each
// ends on u.id so "Load more" pages never repeat or skip a worker.
const WORKER_SORTS = {
  recommended: sql`wp.avg_rating DESC NULLS LAST, wp.total_jobs_done DESC NULLS LAST, u.id`,
  // Same Bayesian rating as the match agent (prior weight 3, platform
  // average as the prior): one 5-star review doesn't outrank 30 reviews at 4.9.
  rating: sql`(3 * COALESCE((SELECT AVG(rating) FROM reviews), 4.0) + (SELECT COUNT(*) FROM reviews r WHERE r.worker_id = u.id) * COALESCE(wp.avg_rating, 0)) / (3 + (SELECT COUNT(*) FROM reviews r WHERE r.worker_id = u.id)) DESC, wp.avg_rating DESC NULLS LAST, u.id`,
  jobs: sql`wp.total_jobs_done DESC NULLS LAST, wp.avg_rating DESC NULLS LAST, u.id`,
  newest: sql`u.created_at DESC, u.id`,
};
function workerFilters({ category, district, minRating, verified, newOnly, newMaxJobs, search }) { return sql`
  u.role = 'worker' AND u.is_suspended = false
    AND (${category}::text IS NULL OR EXISTS (SELECT 1 FROM worker_skills ws JOIN categories c ON c.id = ws.category_id WHERE ws.worker_id = wp.id AND c.name ILIKE ${`%${category || ''}%`}))
    AND (${district}::text IS NULL OR u.district ILIKE ${`%${district || ''}%`})
    AND (${minRating}::numeric IS NULL OR wp.avg_rating >= ${minRating})
    AND (${verified}::boolean = false OR u.is_nic_verified = true)
    AND (${newOnly}::boolean = false OR COALESCE(wp.total_jobs_done, 0) < ${newMaxJobs})
    AND (${search}::text IS NULL OR u.full_name ILIKE ${`%${search || ''}%`} OR wp.primary_skill ILIKE ${`%${search || ''}%`})
`; }
function listWorkers({ sort = 'recommended', limit, offset, ...filters }) { return rows(sql`
  SELECT u.id, u.full_name, u.district, u.area, u.profile_photo, u.is_nic_verified, u.created_at,
    wp.primary_skill, wp.starting_price, wp.total_jobs_done, wp.avg_rating, wp.bio
  FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
  WHERE ${workerFilters(filters)}
  ORDER BY ${WORKER_SORTS[sort] || WORKER_SORTS.recommended} LIMIT ${limit} OFFSET ${offset}
`); }
function countWorkers(filters) { return one(sql`
  SELECT COUNT(*)::int AS count FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
  WHERE ${workerFilters(filters)}
`); }
function publicWorker(id) { return one(sql`SELECT u.id, u.full_name, u.district, u.area, u.profile_photo, u.is_nic_verified, u.phone, u.created_at, wp.bio, wp.starting_price, wp.primary_skill, wp.total_jobs_done, wp.avg_rating, (SELECT COUNT(*)::int FROM reviews r WHERE r.worker_id=u.id) AS review_count FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=${id} AND u.role='worker' AND u.is_suspended=false`); }
function publicMarketplaceStats() { return one(sql`
  SELECT
    (SELECT COUNT(*)::int FROM users WHERE role='worker' AND is_suspended=false) AS workers,
    (SELECT COUNT(*)::int FROM users WHERE role='worker' AND is_suspended=false AND is_nic_verified=true) AS verified_workers,
    (SELECT COUNT(DISTINCT district)::int FROM users WHERE role='worker' AND is_suspended=false AND district IS NOT NULL) AS districts,
    (SELECT COUNT(*)::int FROM reviews) AS reviews,
    (SELECT ROUND(AVG(rating), 1)::text FROM reviews) AS avg_rating,
    (SELECT COUNT(*)::int FROM jobs WHERE status IN ('completed','payment_recorded','reviewed')) AS completed_jobs
`); }
function workerReviews(id, limit, offset) { return rows(sql`SELECT r.id,r.rating,r.feedback,r.created_at,u.full_name AS customer_name,u.profile_photo AS customer_photo,j.title AS job_title FROM reviews r JOIN users u ON u.id=r.customer_id JOIN jobs j ON j.id=r.job_id WHERE r.worker_id=${id} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`); }
function customerSummary(id) { return one(sql`SELECT u.id,u.full_name,u.district,u.area,u.profile_photo,u.created_at, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id) AS jobs_posted, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id AND status IN ('posted','proposals_received','assigned','in_progress')) AS active_jobs, (SELECT COUNT(*)::int FROM jobs WHERE customer_id=u.id AND status IN ('completed','payment_recorded','reviewed')) AS jobs_completed, (SELECT COUNT(*)::int FROM reviews WHERE customer_id=u.id) AS reviews_given FROM users u WHERE u.id=${id} AND u.role='customer' AND u.is_suspended=false`); }
function customerRecentJobs(id) { return rows(sql`SELECT j.id,j.title,j.status,j.created_at,c.name AS category_name,(SELECT COUNT(*)::int FROM proposals p WHERE p.job_id=j.id) AS proposal_count FROM jobs j LEFT JOIN categories c ON c.id=j.category_id WHERE j.customer_id=${id} AND j.status NOT IN ('completed','payment_recorded','reviewed') ORDER BY j.created_at DESC LIMIT 4`); }

// Finished jobs shown on public profiles. Only jobs that are done, not taken
// down by an admin, and between two accounts in good standing. No address,
// phone or messages: the street address stays private to the two parties.
const DONE_JOB = sql`j.status IN ('completed','payment_recorded','reviewed') AND j.is_active = true AND j.flagged_at IS NULL AND cu.is_suspended = false AND wu.is_suspended = false`;
const COMPLETED_AT = sql`COALESCE((SELECT MAX(e.created_at) FROM job_status_events e WHERE e.job_id = j.id AND e.status = 'completed'), j.updated_at)`;
function doneJobsFilter({ workerId, customerId }) { return workerId ? sql`j.assigned_worker_id = ${workerId}` : sql`j.customer_id = ${customerId}`; }
function completedJobs({ workerId, customerId, limit, offset }) { return rows(sql`
  SELECT j.id, j.title, j.district, j.town, c.name AS category_name, ${COMPLETED_AT} AS completed_at,
         wu.id AS worker_id, wu.full_name AS worker_name, wu.profile_photo AS worker_photo,
         r.rating, (SELECT ph.path FROM job_photos ph WHERE ph.job_id = j.id ORDER BY ph.order_idx LIMIT 1) AS cover_photo
  FROM jobs j
  JOIN users cu ON cu.id = j.customer_id
  JOIN users wu ON wu.id = j.assigned_worker_id
  LEFT JOIN categories c ON c.id = j.category_id
  LEFT JOIN reviews r ON r.job_id = j.id
  WHERE ${doneJobsFilter({ workerId, customerId })} AND ${DONE_JOB}
  ORDER BY completed_at DESC, j.id
  LIMIT ${limit} OFFSET ${offset}
`); }
function countCompletedJobs({ workerId, customerId }) { return one(sql`SELECT COUNT(*)::int AS count FROM jobs j JOIN users cu ON cu.id = j.customer_id JOIN users wu ON wu.id = j.assigned_worker_id WHERE ${doneJobsFilter({ workerId, customerId })} AND ${DONE_JOB}`); }
function completedJobShowcase(jobId) { return one(sql`
  SELECT j.id, j.title, j.description, j.district, j.town, j.status, j.created_at, ${COMPLETED_AT} AS completed_at,
         CASE WHEN j.status IN ('payment_recorded','reviewed') THEN j.final_price END AS final_price,
         c.name AS category_name,
         cu.id AS customer_id, cu.full_name AS customer_name, cu.profile_photo AS customer_photo,
         wu.id AS worker_id, wu.full_name AS worker_name, wu.profile_photo AS worker_photo, wu.is_nic_verified AS worker_verified,
         wp.primary_skill AS worker_primary_skill, wp.avg_rating AS worker_avg_rating, wp.total_jobs_done AS worker_jobs_done,
         r.rating AS review_rating, r.feedback AS review_feedback, r.created_at AS reviewed_at
  FROM jobs j
  JOIN users cu ON cu.id = j.customer_id
  JOIN users wu ON wu.id = j.assigned_worker_id
  LEFT JOIN worker_profiles wp ON wp.user_id = wu.id
  LEFT JOIN categories c ON c.id = j.category_id
  LEFT JOIN reviews r ON r.job_id = j.id
  WHERE j.id = ${jobId} AND ${DONE_JOB}
`); }
function completedJobPhotos(jobId) { return rows(sql`SELECT id, path FROM job_photos WHERE job_id = ${jobId} ORDER BY order_idx LIMIT 10`); }

module.exports = instrumentRepository('identity', {
  createWorkerProfile, deletePortfolioPhoto, findAuthUserByEmail, findCategoryByName, findResetEligibleUser,
  findSessionUser, insertPortfolioPhoto, insertUser, insertWorkerSkill, portfolioCount, resetPassword,
  selfProfile, setAiMatchingOptIn, setDashboardMode, setNicImage, setPasswordResetToken, setProfilePhoto,
  updateProfile, updateWorkerProfile, verifyEmail, workerPortfolio, workerProfileId, workerSkills,
  countWorkers, customerRecentJobs, customerSummary, listWorkers, publicWorker, workerReviews,
  findVerificationState, publicMarketplaceStats, setEmailVerifyToken,
  completedJobs, countCompletedJobs, completedJobShowcase, completedJobPhotos,
});
