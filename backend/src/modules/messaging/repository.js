'use strict';

const { sql } = require('drizzle-orm');
const { db } = require('../../db/drizzle');
const { instrumentRepository } = require('../../observability/request-context');

/** @typedef {typeof db | import('../../db/transaction').DrizzleTransactionClient} QueryExecutor */

/** @param {import('drizzle-orm').SQL} statement @param {QueryExecutor} [client] @returns {Promise<any[]>} */
async function rows(statement, client = db) {
  return /** @type {any[]} */ ((await client.execute(statement)).rows);
}

/** @param {import('drizzle-orm').SQL} statement @param {QueryExecutor} [client] @returns {Promise<any | null>} */
async function one(statement, client = db) {
  return (await rows(statement, client))[0] || null;
}

/** Everything needed to decide who may read or write a (job, worker) thread. @param {string} jobId @param {string} workerId */
function threadContext(jobId, workerId) {
  return one(sql`
    SELECT j.id AS job_id, j.title AS job_title, j.status AS job_status, j.is_active AS job_is_active,
           j.customer_id, j.assigned_worker_id,
           c.full_name AS customer_name, c.profile_photo AS customer_photo,
           w.id AS worker_id, w.full_name AS worker_name, w.profile_photo AS worker_photo,
           EXISTS(SELECT 1 FROM proposals p WHERE p.job_id = j.id AND p.worker_id = w.id) AS has_proposal,
           EXISTS(SELECT 1 FROM invites i WHERE i.job_id = j.id AND i.worker_id = w.id) AS has_invite
    FROM jobs j
    JOIN users c ON c.id = j.customer_id
    JOIN users w ON w.id = ${workerId} AND w.role = 'worker'
    WHERE j.id = ${jobId}
  `);
}

/** Most recent messages in a thread, oldest first. @param {string} jobId @param {string} workerId @param {number} [limit] */
function listThreadMessages(jobId, workerId, limit = 200) {
  return rows(sql`
    SELECT * FROM (
      SELECT id, job_id, worker_id, sender_id, body, read_at, created_at
      FROM job_messages
      WHERE job_id = ${jobId} AND worker_id = ${workerId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    ) recent
    ORDER BY created_at ASC
  `);
}

/** @param {{ jobId: string, workerId: string, senderId: string, body: string }} input @param {QueryExecutor} [client] */
function insertMessage(input, client) {
  return one(sql`
    INSERT INTO job_messages (job_id, worker_id, sender_id, body)
    VALUES (${input.jobId}, ${input.workerId}, ${input.senderId}, ${input.body})
    RETURNING id, job_id, worker_id, sender_id, body, read_at, created_at
  `, client);
}

/** Unread messages in the thread from anyone other than `recipientId`, excluding one message. */
function countUnreadForRecipient(jobId, workerId, recipientId, excludeId, client) {
  return one(sql`
    SELECT COUNT(*)::int AS count FROM job_messages
    WHERE job_id = ${jobId} AND worker_id = ${workerId} AND sender_id <> ${recipientId}
      AND read_at IS NULL AND id <> ${excludeId}
  `, client);
}

/** @param {string} jobId @param {string} workerId @param {string} readerId */
function markThreadRead(jobId, workerId, readerId) {
  return rows(sql`
    UPDATE job_messages SET read_at = NOW()
    WHERE job_id = ${jobId} AND worker_id = ${workerId} AND sender_id <> ${readerId} AND read_at IS NULL
    RETURNING id
  `);
}

function participantCondition(userId, role) {
  return role === 'customer' ? sql`j.customer_id = ${userId}` : sql`m.worker_id = ${userId}`;
}

/** Threads the user takes part in, newest activity first. @param {string} userId @param {'customer' | 'worker'} role */
function listConversations(userId, role, limit = 100) {
  return rows(sql`
    WITH threads AS (
      SELECT m.job_id, m.worker_id,
             MAX(m.created_at) AS last_message_at,
             COUNT(*) FILTER (WHERE m.sender_id <> ${userId} AND m.read_at IS NULL)::int AS unread_count
      FROM job_messages m
      JOIN jobs j ON j.id = m.job_id
      WHERE ${participantCondition(userId, role)}
      GROUP BY m.job_id, m.worker_id
    )
    SELECT t.job_id, t.worker_id, t.last_message_at, t.unread_count,
           j.title AS job_title, j.status AS job_status,
           last.body AS last_message, last.sender_id AS last_sender_id,
           other.id AS other_user_id, other.full_name AS other_name, other.profile_photo AS other_photo
    FROM threads t
    JOIN jobs j ON j.id = t.job_id
    JOIN users other ON other.id = CASE WHEN ${role} = 'customer' THEN t.worker_id ELSE j.customer_id END
    JOIN LATERAL (
      SELECT body, sender_id FROM job_messages lm
      WHERE lm.job_id = t.job_id AND lm.worker_id = t.worker_id
      ORDER BY lm.created_at DESC LIMIT 1
    ) last ON true
    ORDER BY t.last_message_at DESC
    LIMIT ${limit}
  `);
}

/** @param {string} userId @param {'customer' | 'worker'} role */
function unreadCount(userId, role) {
  return one(sql`
    SELECT COUNT(*)::int AS count
    FROM job_messages m JOIN jobs j ON j.id = m.job_id
    WHERE ${participantCondition(userId, role)} AND m.sender_id <> ${userId} AND m.read_at IS NULL
  `);
}

/** @param {{ userId: string, type: string, title: string, body: string, meta: unknown }} input @param {QueryExecutor} [client] */
function insertNotification(input, client) {
  return one(sql`INSERT INTO notifications (user_id,type,title,body,meta) VALUES (${input.userId},${input.type},${input.title},${input.body},${JSON.stringify(input.meta)}) RETURNING id`, client);
}

module.exports = instrumentRepository('messaging', {
  countUnreadForRecipient, insertMessage, insertNotification, listConversations, listThreadMessages,
  markThreadRead, threadContext, unreadCount,
});
