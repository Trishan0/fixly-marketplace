const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');
const { maskPrice } = require('../services/priceVisibility');

// POST /api/jobs/:jobId/proposals
router.post('/', verifyToken, requireRole('worker'), async (req, res) => {
  const { jobId } = req.params;
  const { proposed_price, inspection_needed, availability, message } = req.body;

  try {
    const jobResult = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!['posted', 'proposals_received'].includes(job.status)) {
      return res.status(400).json({ error: 'Job is not accepting proposals' });
    }

    const result = await pool.query(
      `INSERT INTO proposals (job_id, worker_id, proposed_price, inspection_needed, availability, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [jobId, req.user.id, proposed_price || null, inspection_needed || false, availability, message]
    );

    // Auto-transition job to proposals_received
    if (job.status === 'posted') {
      await pool.query(`UPDATE jobs SET status = 'proposals_received', updated_at = NOW() WHERE id = $1`, [jobId]);
    }

    await createNotification(
      job.customer_id, 'new_proposal', 'New Proposal Received',
      `${req.user.full_name} sent a proposal for: ${job.title}`,
      { job_id: jobId, worker_id: req.user.id }
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already submitted a proposal for this job' });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/jobs/:jobId/proposals
router.get('/', verifyToken, async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only job owner and workers can view
    if (req.user.role === 'customer' && req.user.id !== job.customer_id) {
      return res.status(403).json({ error: 'Not your job' });
    }

    let query = `SELECT p.*, u.full_name as worker_name, u.profile_photo as worker_photo,
                        u.is_nic_verified, wp.avg_rating, wp.total_jobs_done, wp.primary_skill
                 FROM proposals p
                 JOIN users u ON u.id = p.worker_id
                 LEFT JOIN worker_profiles wp ON wp.user_id = p.worker_id
                 WHERE p.job_id = $1`;
    const params = [jobId];

    // Workers only see their own proposals
    if (req.user.role === 'worker') {
      query += ' AND p.worker_id = $2';
      params.push(req.user.id);
    }

    query += ' ORDER BY p.created_at ASC';

    const result = await pool.query(query, params);
    const proposals = maskPrice(result.rows, req.user.id, job.customer_id, job.status);

    res.json(proposals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
