const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

// POST /api/jobs/:jobId/invites
router.post('/', verifyToken, requireRole('customer'), async (req, res) => {
  const { jobId } = req.params;
  const { worker_id, message } = req.body;

  try {
    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1 AND customer_id = $2', [jobId, req.user.id]);
    if (!jobResult.rows[0]) return res.status(404).json({ error: 'Job not found' });

    const workerResult = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'worker'", [worker_id]);
    if (!workerResult.rows[0]) return res.status(404).json({ error: 'Worker not found' });

    const result = await pool.query(
      `INSERT INTO invites (job_id, customer_id, worker_id, message) VALUES ($1,$2,$3,$4) RETURNING *`,
      [jobId, req.user.id, worker_id, message]
    );

    await createNotification(
      worker_id, 'new_invite', 'New Job Invite',
      `You have been invited to a job: ${jobResult.rows[0].title}`,
      { job_id: jobId }
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already invited this worker' });
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
