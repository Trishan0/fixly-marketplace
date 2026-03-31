const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { recalcRating } = require('../services/ratingRecalc');
const { createNotification } = require('../services/notificationDispatch');

// POST /api/jobs/:jobId/review
router.post('/jobs/:jobId/review', verifyToken, requireRole('customer'), async (req, res) => {
  const { rating, feedback } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

  try {
    const jobResult = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [req.params.jobId, req.user.id]
    );
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!['completed', 'payment_recorded'].includes(job.status)) {
      return res.status(400).json({ error: 'Job must be completed before reviewing' });
    }
    if (!job.assigned_worker_id) return res.status(400).json({ error: 'No worker assigned' });

    const result = await pool.query(
      `INSERT INTO reviews (job_id, customer_id, worker_id, rating, feedback)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.jobId, req.user.id, job.assigned_worker_id, rating, feedback]
    );

    await pool.query(
      `UPDATE jobs SET status = 'reviewed', updated_at = NOW() WHERE id = $1`,
      [req.params.jobId]
    );

    await recalcRating(job.assigned_worker_id);

    await createNotification(
      job.assigned_worker_id, 'review_received', 'New Review',
      `You received a ${rating}-star review for: ${job.title}`,
      { job_id: job.id, rating }
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already reviewed this job' });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
