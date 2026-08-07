/**
 * submitProposal.js — Tool: submit a proposal and send notification.
 * Direct DB operation — does not depend on the route handler.
 */

const pool = require('../../db');
const { createNotification } = require('../../services/notificationDispatch');

/**
 * @param {string} jobId
 * @param {string} workerId     — the authenticated worker's user id
 * @param {Object} opts
 * @param {string} opts.message
 * @param {number|null} opts.proposed_price
 * @param {boolean} opts.inspection_needed
 * @param {string} opts.availability
 * @returns {{ proposal: Object, alreadyExists: boolean }}
 */
async function submitProposal(jobId, workerId, {
  message = '',
  proposed_price = null,
  inspection_needed = false,
  availability = '',
} = {}) {
  // Validate job
  const jobResult = await pool.query(
    `SELECT id, title, status, customer_id FROM jobs WHERE id = $1`,
    [jobId]
  );
  const job = jobResult.rows[0];
  if (!job) throw new Error('Job not found');
  if (!['posted', 'proposals_received'].includes(job.status)) {
    throw new Error('Job is not accepting proposals');
  }

  // Idempotent insert
  const insertResult = await pool.query(
    `INSERT INTO proposals (job_id, worker_id, proposed_price, inspection_needed, availability, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (job_id, worker_id) DO NOTHING
     RETURNING *`,
    [jobId, workerId, proposed_price, inspection_needed, availability, message]
  );

  if (insertResult.rows.length === 0) {
    const existing = await pool.query(
      `SELECT * FROM proposals WHERE job_id = $1 AND worker_id = $2`,
      [jobId, workerId]
    );
    return { proposal: existing.rows[0], alreadyExists: true };
  }

  // Auto-transition job status
  if (job.status === 'posted') {
    await pool.query(
      `UPDATE jobs SET status = 'proposals_received', updated_at = NOW() WHERE id = $1`,
      [jobId]
    );
  }

  // Notify customer
  const workerResult = await pool.query(
    `SELECT full_name FROM users WHERE id = $1`,
    [workerId]
  );
  const workerName = workerResult.rows[0]?.full_name || 'A worker';

  await createNotification(
    job.customer_id,
    'new_proposal',
    'New Proposal Received',
    `${workerName} sent a proposal for: "${job.title}"`,
    { job_id: jobId, worker_id: workerId }
  );

  return { proposal: insertResult.rows[0], alreadyExists: false };
}

module.exports = { submitProposal };
