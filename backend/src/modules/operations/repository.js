'use strict';

const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');
const { instrumentRepository } = require('../../observability/request-context');

/** @typedef {{ userId: string, type: string, title: string, body: string, meta: unknown }} NotificationInput */
/** @typedef {{ reporterId: string, reportedUserId: string | null, jobId: string | null, type: string, description: string }} ReportInput */
/** @typedef {{ role: string | null, search: string | null, suspended: boolean, limit: number, offset: number }} AdminUserFilters */
/** @typedef {{ status: string | null, category: string | null, district: string | null, limit: number, offset: number }} AdminJobFilters */
/** @typedef {{ actorId: string, forceVerified: boolean | null, suspended: boolean | null, nicVerified: boolean | null }} AdminUserUpdate */
/** @typedef {{ actorId: string, action: string, entityType: string, entityId: string, reason: string | null, beforeState: unknown, afterState: unknown }} AuditInput */
/** @typedef {{ name: string, icon: string | null, parentId: string | null }} CategoryInput */
/** @typedef {{ actorId: string, status: string, note: string | null }} ReportResolution */
/** @typedef {typeof db | import('../../db/transaction').DrizzleTransactionClient} QueryExecutor */

/** @param {import('drizzle-orm').SQL} statement @param {QueryExecutor} [client] @returns {Promise<any[]>} */
async function rows(statement, client = db) {
  return /** @type {any[]} */ ((await client.execute(statement)).rows);
}

/** @param {import('drizzle-orm').SQL} statement @param {QueryExecutor} [client] @returns {Promise<any | null>} */
async function one(statement, client = db) {
  return (await rows(statement, client))[0] || null;
}

/** @param {string} userId @param {number} [limit] */
function listNotifications(userId, limit = 50) {
  return rows(sql`SELECT id,type,title,body,is_read,meta,created_at FROM notifications WHERE user_id=${userId} ORDER BY created_at DESC LIMIT ${limit}`);
}

/** @param {NotificationInput} input @param {QueryExecutor} [client] */
function insertNotification(input, client) {
  return one(sql`INSERT INTO notifications (user_id,type,title,body,meta) VALUES (${input.userId},${input.type},${input.title},${input.body},${JSON.stringify(input.meta)}) RETURNING id`, client);
}

/** @param {string} id @param {string} userId */
function markNotificationRead(id, userId) {
  return one(sql`UPDATE notifications SET is_read=true WHERE id=${id} AND user_id=${userId} AND is_read=false RETURNING id`);
}

/** @param {string} userId */
function markAllNotificationsRead(userId) {
  return rows(sql`UPDATE notifications SET is_read=true WHERE user_id=${userId} AND is_read=false RETURNING id`);
}

/** @param {ReportInput} input */
function insertReport(input) {
  return one(sql`INSERT INTO reports (reporter_id,reported_user_id,job_id,report_type,description) VALUES (${input.reporterId},${input.reportedUserId},${input.jobId},${input.type},${input.description}) RETURNING id,reporter_id,reported_user_id,job_id,report_type,description,status,created_at`);
}

/** @param {string} userId */
function listMyReports(userId) {
  return rows(sql`SELECT r.id,r.report_type,r.description,r.status,r.resolution_note,r.created_at,r.updated_at,u.full_name AS reported_user_name,j.title AS job_title FROM reports r LEFT JOIN users u ON u.id=r.reported_user_id LEFT JOIN jobs j ON j.id=r.job_id WHERE r.reporter_id=${userId} ORDER BY r.created_at DESC LIMIT 100`);
}

/** @param {string} keyHash @param {Date | string} expiresAt */
function incrementRateLimit(keyHash, expiresAt) {
  return one(sql`INSERT INTO rate_limit_buckets (key_hash,count,expires_at) VALUES (${keyHash},1,${expiresAt}) ON CONFLICT (key_hash) DO UPDATE SET count=rate_limit_buckets.count+1 RETURNING count`);
}

function cleanupRateLimitBuckets() {
  return rows(sql`DELETE FROM rate_limit_buckets WHERE expires_at < NOW() RETURNING key_hash`);
}

function adminStats() {
  return one(sql`SELECT (SELECT COUNT(*)::int FROM users WHERE role <> 'admin') AS total_users,(SELECT COUNT(*)::int FROM users WHERE role='worker') AS total_workers,(SELECT COUNT(*)::int FROM jobs) AS total_jobs,(SELECT COUNT(*)::int FROM reports WHERE status='open') AS open_reports,(SELECT COUNT(*)::int FROM jobs WHERE status IN ('posted','proposals_received')) AS open_jobs`);
}

/** @param {AdminUserFilters} filters */
function adminUsers({ role, search, suspended, limit, offset }) {
  return rows(sql`SELECT u.id,u.email,u.full_name,u.role,u.phone,u.district,u.is_email_verified,u.is_nic_verified,u.force_verified,u.is_suspended,u.created_at,wp.avg_rating,wp.total_jobs_done FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE (${role}::text IS NULL OR u.role=${role}) AND (${search}::text IS NULL OR u.full_name ILIKE ${`%${search || ''}%`} OR u.email ILIKE ${`%${search || ''}%`}) AND (${suspended}::boolean=false OR u.is_suspended=true) ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
}

/** @param {Pick<AdminUserFilters, 'role' | 'search' | 'suspended'>} filters */
function countAdminUsers({ role, search, suspended }) {
  return one(sql`SELECT COUNT(*)::int AS count FROM users u WHERE (${role}::text IS NULL OR u.role=${role}) AND (${search}::text IS NULL OR u.full_name ILIKE ${`%${search || ''}%`} OR u.email ILIKE ${`%${search || ''}%`}) AND (${suspended}::boolean=false OR u.is_suspended=true)`);
}

/** @param {string} id */
function adminUser(id) {
  return one(sql`SELECT u.id,u.email,u.full_name,u.role,u.phone,u.district,u.profile_photo,u.is_email_verified,u.is_nic_verified,u.force_verified,u.is_suspended,u.dashboard_mode,u.created_at,wp.bio,wp.starting_price,wp.primary_skill,wp.total_jobs_done,wp.avg_rating FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=${id}`);
}

/** @param {string} id @param {AdminUserUpdate} fields @param {QueryExecutor} [client] */
function updateAdminUser(id, fields, client) {
  return one(sql`UPDATE users SET force_verified=COALESCE(${fields.forceVerified},force_verified),is_suspended=COALESCE(${fields.suspended},is_suspended),is_nic_verified=COALESCE(${fields.nicVerified},is_nic_verified),nic_verified_by=CASE WHEN ${fields.nicVerified}::boolean THEN ${fields.actorId} ELSE nic_verified_by END,updated_at=NOW() WHERE id=${id} RETURNING id,force_verified,is_suspended,is_nic_verified`, client);
}

/** @param {AuditInput} input @param {QueryExecutor} [client] */
function insertAudit(input, client) {
  return one(sql`INSERT INTO admin_audit_logs (actor_id,action,entity_type,entity_id,reason,before_state,after_state) VALUES (${input.actorId},${input.action},${input.entityType},${input.entityId},${input.reason},${JSON.stringify(input.beforeState)},${JSON.stringify(input.afterState)}) RETURNING id`, client);
}

function listAdminWorkers() {
  return rows(sql`SELECT u.id,u.full_name,u.email,u.phone,u.district,u.nic_image_path,u.is_nic_verified,u.force_verified,u.is_suspended,u.created_at,wp.primary_skill,wp.avg_rating,wp.total_jobs_done FROM users u LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.role='worker' ORDER BY u.is_nic_verified ASC,u.created_at DESC LIMIT 500`);
}

/** @param {AdminJobFilters} filters */
function listAdminJobs({ status, category, district, limit, offset }) {
  return rows(sql`SELECT j.id,j.customer_id,j.title,j.description,j.category_id,j.district,j.status,j.is_active,j.created_at,c.name AS category_name,u.full_name AS customer_name FROM jobs j LEFT JOIN categories c ON c.id=j.category_id LEFT JOIN users u ON u.id=j.customer_id WHERE (${status}::text IS NULL OR j.status=${status}) AND (${category}::text IS NULL OR c.name ILIKE ${`%${category || ''}%`}) AND (${district}::text IS NULL OR j.district ILIKE ${`%${district || ''}%`}) ORDER BY j.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
}

/** @param {Pick<AdminJobFilters, 'status' | 'category' | 'district'>} filters */
function countAdminJobs({ status, category, district }) {
  return one(sql`SELECT COUNT(*)::int AS count FROM jobs j LEFT JOIN categories c ON c.id=j.category_id WHERE (${status}::text IS NULL OR j.status=${status}) AND (${category}::text IS NULL OR c.name ILIKE ${`%${category || ''}%`}) AND (${district}::text IS NULL OR j.district ILIKE ${`%${district || ''}%`})`);
}

/** @param {string | null} status @param {string | null} type */
function listAdminReports(status, type) {
  return rows(sql`SELECT r.id,r.reporter_id,r.reported_user_id,r.job_id,r.report_type,r.description,r.status,r.resolution_note,r.created_at,r.updated_at,u1.full_name AS reporter_name,u2.full_name AS reported_user_name,j.title AS job_title FROM reports r LEFT JOIN users u1 ON u1.id=r.reporter_id LEFT JOIN users u2 ON u2.id=r.reported_user_id LEFT JOIN jobs j ON j.id=r.job_id WHERE (${status}::text IS NULL OR r.status=${status}) AND (${type}::text IS NULL OR r.report_type=${type}) ORDER BY r.created_at DESC LIMIT 100`);
}

function listCategoriesAdmin() {
  return rows(sql`SELECT id,name,icon,parent_id,is_active FROM categories ORDER BY name LIMIT 500`);
}

/** @param {string} id @param {QueryExecutor} [client] */
function findCategory(id, client) {
  return one(sql`SELECT id,name,icon,parent_id,is_active FROM categories WHERE id=${id} FOR UPDATE`, client);
}

/** @param {CategoryInput} input @param {QueryExecutor} [client] */
function insertCategory(input, client) {
  return one(sql`INSERT INTO categories (name,icon,parent_id) VALUES (${input.name},${input.icon},${input.parentId}) RETURNING id,name,icon,parent_id,is_active`, client);
}

/** @param {string} id @param {{ name: string | null, icon: string | null, isActive: boolean | null }} input @param {QueryExecutor} [client] */
function updateCategory(id, input, client) {
  return one(sql`UPDATE categories SET name=COALESCE(${input.name},name),icon=COALESCE(${input.icon},icon),is_active=COALESCE(${input.isActive},is_active) WHERE id=${id} RETURNING id,name,icon,parent_id,is_active`, client);
}

/** @param {string} id @param {QueryExecutor} [client] */
function flagJob(id, client) {
  return one(sql`UPDATE jobs SET is_active=false,updated_at=NOW() WHERE id=${id} RETURNING id,is_active,status`, client);
}

/** @param {string} id @param {ReportResolution} input @param {QueryExecutor} [client] */
function resolveReport(id, input, client) {
  return one(sql`UPDATE reports SET status=${input.status},resolution_note=${input.note},resolved_by=${input.actorId},updated_at=NOW() WHERE id=${id} AND status IN ('open','reviewing') RETURNING id,reporter_id,status,resolution_note`, client);
}

module.exports = instrumentRepository('operations', {
  adminStats, adminUser, adminUsers, cleanupRateLimitBuckets, countAdminJobs, countAdminUsers,
  flagJob, findCategory, incrementRateLimit, insertAudit, insertCategory, insertNotification,
  insertReport, listAdminJobs, listAdminReports, listAdminWorkers, listCategoriesAdmin,
  listMyReports, listNotifications, markAllNotificationsRead, markNotificationRead, resolveReport,
  updateAdminUser, updateCategory,
});
