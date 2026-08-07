/**
 * createInvite.js — Tool: create an invite and send notification.
 * Direct DB operation — does not depend on the route handler.
 */

const pool = require('../../db');
const { createNotification } = require('../../services/notificationDispatch');

/**
 * @param {string} jobId
 * @param {string} customerId  — the authenticated customer's user id
 * @param {string} workerId    — the target worker's user id
 * @param {string} message     — optional invite message
 * @returns {{ invite: Object, alreadyExists: boolean }}
 */
async function createInvite(jobId, customerId, workerId, message = '') {
  // Verify job ownership
  const jobResult = await pool.query(
    `SELECT id, title, status, customer_id FROM jobs WHERE id = $1`,
    [jobId]
  );
  const job = jobResult.rows[0];
  if (!job) throw new Error('Job not found');
  if (job.customer_id !== customerId) throw new Error('Not your job');
  if (!['posted', 'proposals_received'].includes(job.status)) {
    throw new Error('Job is not accepting invites');
  }

  // Idempotent insert
  const insertResult = await pool.query(
    `INSERT INTO invites (job_id, customer_id, worker_id, message)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (job_id, worker_id) DO NOTHING
     RETURNING *`,
    [jobId, customerId, workerId, message || null]
  );

  if (insertResult.rows.length === 0) {
    // Already existed
    const existing = await pool.query(
      `SELECT * FROM invites WHERE job_id = $1 AND worker_id = $2`,
      [jobId, workerId]
    );
    return { invite: existing.rows[0], alreadyExists: true };
  }

  // Send notification to worker
  await createNotification(
    workerId,
    'invite_received',
    'You received a job invite',
    `You've been invited to: "${job.title}"`,
    { job_id: jobId, customer_id: customerId }
  );

  return { invite: insertResult.rows[0], alreadyExists: false };
}

module.exports = { createInvite };
