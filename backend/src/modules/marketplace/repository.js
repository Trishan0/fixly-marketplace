const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');
const { instrumentRepository } = require('../../observability/request-context');

function executor(client = db) {
  return client;
}

async function rows(statement, client) {
  return (await executor(client).execute(statement)).rows;
}

async function one(statement, client) {
  return (await rows(statement, client))[0] || null;
}

function insertNotification({ userId, type, title, body, meta }, client) {
  return one(sql`
    INSERT INTO notifications (user_id, type, title, body, meta)
    VALUES (${userId}, ${type}, ${title}, ${body}, ${JSON.stringify(meta)})
    RETURNING id, user_id, type, title, body, meta, created_at
  `, client);
}

function createJob(input) {
  return one(sql`
    INSERT INTO jobs (
      customer_id, title, description, category_id, subcategory_id, district,
      town, address, urgency, pricing_mode, fixed_budget
    ) VALUES (
      ${input.customerId}, ${input.title}, ${input.description}, ${input.categoryId},
      ${input.subcategoryId}, ${input.district}, ${input.town}, ${input.address},
      ${input.urgency}, ${input.pricingMode}, ${input.fixedBudget}
    )
    RETURNING *
  `);
}

function findJobById(jobId, client) {
  return one(sql`SELECT * FROM jobs WHERE id = ${jobId}`, client);
}

function findOwnedJob(jobId, customerId) {
  return one(sql`SELECT id FROM jobs WHERE id = ${jobId} AND customer_id = ${customerId}`);
}

function findJobForUpdate(jobId, client) {
  return one(sql`SELECT * FROM jobs WHERE id = ${jobId} FOR UPDATE`, client);
}

function findProposalForUpdate(proposalId, client) {
  return one(sql`
    SELECT p.*, j.customer_id, j.status AS job_status, j.title AS job_title, j.is_active AS job_is_active
    FROM proposals p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = ${proposalId}
    FOR UPDATE OF p, j
  `, client);
}

function findProposalByJobAndWorker(jobId, workerId, client) {
  return one(sql`SELECT * FROM proposals WHERE job_id = ${jobId} AND worker_id = ${workerId}`, client);
}

function findUserSummary(userId) {
  return one(sql`SELECT id, full_name FROM users WHERE id = ${userId}`);
}

function findWorker(userId, client) {
  return one(sql`SELECT id, full_name FROM users WHERE id = ${userId} AND role = 'worker'`, client);
}

function insertInvite(input, client) {
  return one(sql`
    INSERT INTO invites (job_id, customer_id, worker_id, message)
    VALUES (${input.jobId}, ${input.customerId}, ${input.workerId}, ${input.message})
    ON CONFLICT (job_id, worker_id) DO NOTHING
    RETURNING *
  `, client);
}

function findInviteByJobAndWorker(jobId, workerId, client) {
  return one(sql`SELECT * FROM invites WHERE job_id = ${jobId} AND worker_id = ${workerId}`, client);
}

function findInviteForUpdate(inviteId, client) {
  return one(sql`
    SELECT i.*, j.title AS job_title, j.status AS job_status, j.is_active AS job_is_active
    FROM invites i
    JOIN jobs j ON j.id = i.job_id
    WHERE i.id = ${inviteId}
    FOR UPDATE OF i, j
  `, client);
}

function updateInviteStatus(inviteId, fromStatus, toStatus, client) {
  return one(sql`
    UPDATE invites SET status = ${toStatus}
    WHERE id = ${inviteId} AND status = ${fromStatus}
    RETURNING *
  `, client);
}

function findAgentRunForUpdate(runId, userId, agentType, client) {
  return one(sql`
    SELECT * FROM agent_runs
    WHERE id = ${runId} AND user_id = ${userId} AND agent_type = ${agentType}
    FOR UPDATE
  `, client);
}

function findRecommendation(runId, entityType, entityId, client) {
  return one(sql`
    SELECT * FROM agent_recommendations
    WHERE run_id = ${runId} AND entity_type = ${entityType} AND entity_id = ${entityId}
  `, client);
}

function markRecommendationAction(runId, entityType, entityId, action, client) {
  return one(sql`
    UPDATE agent_recommendations SET action_taken = ${action}, action_at = NOW()
    WHERE run_id = ${runId} AND entity_type = ${entityType} AND entity_id = ${entityId}
    RETURNING *
  `, client);
}

function completeAgentRun(runId, client) {
  return one(sql`
    UPDATE agent_runs SET status = 'completed', completed_at = NOW()
    WHERE id = ${runId} AND status = 'awaiting_confirmation'
    RETURNING *
  `, client);
}

function listReceivedInvites(workerId) {
  return rows(sql`
    SELECT i.*, j.title AS job_title, j.district, j.urgency, j.pricing_mode, j.fixed_budget,
           j.status AS job_status, j.category_id, c.name AS category_name, c.icon AS category_icon,
           u.full_name AS customer_name, u.profile_photo AS customer_photo
    FROM invites i
    JOIN jobs j ON j.id = i.job_id
    LEFT JOIN categories c ON c.id = j.category_id
    JOIN users u ON u.id = i.customer_id
    WHERE i.worker_id = ${workerId}
    ORDER BY i.created_at DESC
  `);
}

function insertProposal(input, client) {
  return one(sql`
    INSERT INTO proposals (job_id, worker_id, proposed_price, inspection_needed, availability, message)
    VALUES (${input.jobId}, ${input.workerId}, ${input.proposedPrice}, ${input.inspectionNeeded}, ${input.availability}, ${input.message})
    ON CONFLICT (job_id, worker_id) DO NOTHING
    RETURNING *
  `, client);
}

function markJobHasProposals(jobId, client) {
  return one(sql`
    UPDATE jobs
    SET status = 'proposals_received', updated_at = NOW()
    WHERE id = ${jobId} AND status = 'posted'
    RETURNING *
  `, client);
}

function acceptProposal(proposalId, client) {
  return one(sql`
    UPDATE proposals SET status = 'accepted', updated_at = NOW()
    WHERE id = ${proposalId} AND status = 'pending'
    RETURNING *
  `, client);
}

function declinePendingProposals(jobId, acceptedProposalId, client) {
  return rows(sql`
    UPDATE proposals SET status = 'declined', updated_at = NOW()
    WHERE job_id = ${jobId} AND id <> ${acceptedProposalId} AND status = 'pending'
    RETURNING id
  `, client);
}

function assignJob(jobId, workerId, client) {
  return one(sql`
    UPDATE jobs
    SET status = 'assigned', assigned_worker_id = ${workerId}, updated_at = NOW()
    WHERE id = ${jobId} AND status IN ('posted', 'proposals_received') AND is_active = true
    RETURNING *
  `, client);
}

function setProposalStatus(proposalId, fromStatus, toStatus, client) {
  return one(sql`
    UPDATE proposals SET status = ${toStatus}, updated_at = NOW()
    WHERE id = ${proposalId} AND status = ${fromStatus}
    RETURNING *
  `, client);
}

function updateJobStatus(jobId, expectedStatus, nextStatus, client) {
  return one(sql`
    UPDATE jobs SET status = ${nextStatus}, updated_at = NOW()
    WHERE id = ${jobId} AND status = ${expectedStatus}
    RETURNING *
  `, client);
}

function updateFinalPrice(jobId, finalPrice, client) {
  return one(sql`
    UPDATE jobs SET final_price = ${finalPrice}, updated_at = NOW()
    WHERE id = ${jobId}
    RETURNING *
  `, client);
}

function cancelJob(jobId, client) {
  return one(sql`
    UPDATE jobs SET status = 'cancelled', is_active = false, updated_at = NOW()
    WHERE id = ${jobId}
    RETURNING *
  `, client);
}

function canWorkerAccessJob(jobId, workerId) {
  return one(sql`
    SELECT
      EXISTS(SELECT 1 FROM jobs WHERE id = ${jobId} AND is_active = true AND status IN ('posted', 'proposals_received')) AS is_public_job,
      EXISTS(SELECT 1 FROM proposals WHERE job_id = ${jobId} AND worker_id = ${workerId}) AS has_proposal,
      EXISTS(SELECT 1 FROM invites WHERE job_id = ${jobId} AND worker_id = ${workerId}) AS has_invite
  `);
}

function listCategories() {
  return rows(sql`SELECT * FROM categories WHERE is_active = true ORDER BY name`);
}

function listJobFeed(workerId, { category, district, page, limit }) {
  const conditions = [
    sql`j.status IN ('posted', 'proposals_received')`,
    sql`j.is_active = true`,
  ];
  if (category) conditions.push(sql`c.name ILIKE ${`%${category}%`}`);
  if (district) conditions.push(sql`j.district ILIKE ${`%${district}%`}`);
  const offset = (page - 1) * limit;

  return rows(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon,
           u.full_name AS customer_name,
           (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) AS proposal_count,
           EXISTS(SELECT 1 FROM proposals myp WHERE myp.job_id = j.id AND myp.worker_id = ${workerId}) AS has_my_proposal,
           (SELECT myp.status FROM proposals myp
            WHERE myp.job_id = j.id AND myp.worker_id = ${workerId}
            ORDER BY myp.created_at DESC LIMIT 1) AS my_proposal_status
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN users u ON u.id = j.customer_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY j.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
}

function listCustomerJobs(customerId, { status, page, limit }) {
  const statusCondition = status ? sql`AND j.status = ${status}` : sql``;
  const offset = (page - 1) * limit;
  return rows(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon,
           u.full_name AS assigned_worker_name, u.profile_photo AS assigned_worker_photo,
           (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) AS proposal_count
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN users u ON u.id = j.assigned_worker_id
    WHERE j.customer_id = ${customerId} ${statusCondition}
    ORDER BY j.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
}

function listAssignedJobs(workerId) {
  return rows(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon, u.full_name AS customer_name
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN users u ON u.id = j.customer_id
    WHERE j.assigned_worker_id = ${workerId}
      AND j.status IN ('assigned', 'in_progress', 'completed', 'payment_recorded', 'reviewed')
    ORDER BY j.updated_at DESC
  `);
}

function findJobDetail(jobId) {
  return one(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon,
           u.full_name AS customer_name, u.phone AS customer_phone, u.profile_photo AS customer_photo,
           aw.full_name AS assigned_worker_name, aw.phone AS assigned_worker_phone, aw.profile_photo AS assigned_worker_photo,
           p.id AS payment_id, p.amount AS payment_amount, p.method AS payment_method,
           p.worker_confirmed AS payment_worker_confirmed, p.disputed AS payment_disputed
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN users u ON u.id = j.customer_id
    LEFT JOIN users aw ON aw.id = j.assigned_worker_id
    LEFT JOIN payments p ON p.job_id = j.id
    WHERE j.id = ${jobId}
  `);
}

function findAgentJobDetails(jobId) {
  return one(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    WHERE j.id = ${jobId}
  `);
}

function listAgentOpenJobs({ district, categoryId, limit }) {
  const conditions = [sql`j.status IN ('posted', 'proposals_received')`, sql`j.is_active = true`];
  if (district) conditions.push(sql`j.district ILIKE ${`%${district}%`}`);
  if (categoryId) conditions.push(sql`j.category_id = ${categoryId}`);
  return rows(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon,
           (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id AND p.status = 'pending') AS proposal_count
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY CASE j.urgency WHEN 'today' THEN 1 WHEN 'tomorrow' THEN 2 WHEN 'this_week' THEN 3 ELSE 4 END,
             j.created_at DESC
    LIMIT ${limit}
  `);
}

function listAgentOpenJobsForWorker(workerId, limit) {
  return rows(sql`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon,
           (SELECT COUNT(*) FROM proposals p2 WHERE p2.job_id = j.id AND p2.status = 'pending') AS proposal_count
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    WHERE j.status IN ('posted', 'proposals_received')
      AND j.is_active = true
      AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.job_id = j.id AND p.worker_id = ${workerId})
    ORDER BY CASE j.urgency WHEN 'today' THEN 1 WHEN 'tomorrow' THEN 2 WHEN 'this_week' THEN 3 ELSE 4 END,
             j.created_at DESC
    LIMIT ${limit}
  `);
}

function listJobProposals(jobId, workerId = null) {
  const workerCondition = workerId ? sql`AND p.worker_id = ${workerId}` : sql``;
  return rows(sql`
    SELECT p.*, u.full_name AS worker_name, u.profile_photo AS worker_photo,
           u.is_nic_verified, wp.avg_rating, wp.total_jobs_done, wp.primary_skill
    FROM proposals p
    JOIN users u ON u.id = p.worker_id
    LEFT JOIN worker_profiles wp ON wp.user_id = p.worker_id
    WHERE p.job_id = ${jobId} ${workerCondition}
    ORDER BY p.created_at ASC
  `);
}

function listJobPhotos(jobId) {
  return rows(sql`SELECT * FROM job_photos WHERE job_id = ${jobId} ORDER BY order_idx`);
}

function insertJobPhoto(jobId, photoPath, orderIdx) {
  return one(sql`
    INSERT INTO job_photos (job_id, path, order_idx)
    VALUES (${jobId}, ${photoPath}, ${orderIdx})
    RETURNING *
  `);
}

function insertPayment(input, client) {
  return one(sql`
    INSERT INTO payments (job_id, amount, method, note, recorded_by)
    VALUES (${input.jobId}, ${input.amount}, ${input.method}, ${input.note}, ${input.recordedBy})
    RETURNING *
  `, client);
}

function findPaymentForUpdate(paymentId, client) {
  return one(sql`
    SELECT p.*, j.customer_id, j.title AS job_title, j.assigned_worker_id, j.id AS job_id, j.status AS job_status
    FROM payments p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = ${paymentId}
    FOR UPDATE OF p, j
  `, client);
}

function updatePaymentStatus(paymentId, status, client) {
  return one(sql`UPDATE payments SET status = ${status} WHERE id = ${paymentId} RETURNING *`, client);
}

function insertReview(input, client) {
  return one(sql`
    INSERT INTO reviews (job_id, customer_id, worker_id, rating, feedback)
    VALUES (${input.jobId}, ${input.customerId}, ${input.workerId}, ${input.rating}, ${input.feedback})
    RETURNING *
  `, client);
}

function rebuildWorkerAggregate(workerId, client) {
  return one(sql`
    UPDATE worker_profiles
    SET avg_rating = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = ${workerId}), 0),
        total_jobs_done = (SELECT COUNT(*)::int FROM jobs j
                           WHERE j.assigned_worker_id = ${workerId}
                             AND j.status IN ('completed', 'payment_recorded', 'reviewed'))
    WHERE user_id = ${workerId}
    RETURNING user_id, avg_rating, total_jobs_done
  `, client);
}

async function workerEarnings(workerId) {
  const [payments, totals] = await Promise.all([
    rows(sql`
      SELECT p.*, j.title AS job_title, j.customer_id, u.full_name AS customer_name
      FROM payments p
      JOIN jobs j ON j.id = p.job_id
      JOIN users u ON u.id = j.customer_id
      WHERE j.assigned_worker_id = ${workerId}
      ORDER BY p.created_at DESC
    `),
    one(sql`
      SELECT
        COALESCE(SUM(p.amount), 0)::text AS total,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmed'), 0)::text AS confirmed_total,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'recorded'), 0)::text AS pending_total,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'disputed'), 0)::text AS disputed_total
      FROM payments p
      JOIN jobs j ON j.id = p.job_id
      WHERE j.assigned_worker_id = ${workerId}
    `),
  ]);
  return { payments, totals };
}

module.exports = instrumentRepository('marketplace', {
  acceptProposal,
  assignJob,
  cancelJob,
  canWorkerAccessJob,
  createJob,
  declinePendingProposals,
  findJobById,
  findOwnedJob,
  findAgentJobDetails,
  findJobDetail,
  findJobForUpdate,
  findAgentRunForUpdate,
  findInviteByJobAndWorker,
  findInviteForUpdate,
  findProposalByJobAndWorker,
  findProposalForUpdate,
  findRecommendation,
  findWorker,
  findUserSummary,
  insertJobPhoto,
  insertInvite,
  insertPayment,
  insertReview,
  insertNotification,
  insertProposal,
  listAssignedJobs,
  listAgentOpenJobs,
  listAgentOpenJobsForWorker,
  listCustomerJobs,
  listJobFeed,
  listCategories,
  listJobPhotos,
  listJobProposals,
  listReceivedInvites,
  markJobHasProposals,
  markRecommendationAction,
  completeAgentRun,
  setProposalStatus,
  findPaymentForUpdate,
  rebuildWorkerAggregate,
  updateFinalPrice,
  updateInviteStatus,
  updatePaymentStatus,
  updateJobStatus,
  workerEarnings,
});
