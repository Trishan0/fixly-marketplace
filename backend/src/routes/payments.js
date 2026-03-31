const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

// POST /api/jobs/:jobId/payment
router.post('/jobs/:jobId/payment', verifyToken, requireRole('customer'), async (req, res) => {
  const { amount, method, note } = req.body;
  if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });

  try {
    const jobResult = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [req.params.jobId, req.user.id]
    );
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job must be completed first' });

    const result = await pool.query(
      `INSERT INTO payments (job_id, amount, method, note, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.jobId, amount, method, note, req.user.id]
    );

    await pool.query(
      `UPDATE jobs SET status = 'payment_recorded', final_price = $1, updated_at = NOW() WHERE id = $2`,
      [amount, req.params.jobId]
    );

    if (job.assigned_worker_id) {
      await createNotification(
        job.assigned_worker_id, 'payment_recorded', 'Payment Recorded',
        `Customer recorded a payment of LKR ${Number(amount).toLocaleString()} for: ${job.title}`,
        { job_id: job.id, payment_id: result.rows[0].id }
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Payment already recorded for this job' });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/payments/:id/confirm
router.put('/:id/confirm', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE payments SET worker_confirmed = true WHERE id = $1 RETURNING *, 
       (SELECT customer_id FROM jobs WHERE id = payments.job_id) as customer_id,
       (SELECT title FROM jobs WHERE id = payments.job_id) as job_title`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Payment not found' });

    await createNotification(
      result.rows[0].customer_id, 'payment_confirmed', 'Payment Confirmed',
      `Worker confirmed payment for: ${result.rows[0].job_title}`,
      { job_id: result.rows[0].job_id }
    );

    res.json({ message: 'Payment confirmed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/payments/:id/dispute
router.put('/:id/dispute', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE payments SET disputed = true WHERE id = $1 RETURNING *,
       (SELECT customer_id FROM jobs WHERE id = payments.job_id) as customer_id,
       (SELECT title FROM jobs WHERE id = payments.job_id) as job_title`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Payment not found' });

    await createNotification(
      result.rows[0].customer_id, 'payment_disputed', 'Payment Disputed',
      `Worker has disputed the payment for: ${result.rows[0].job_title}`,
      { job_id: result.rows[0].job_id }
    );

    res.json({ message: 'Payment disputed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/payments/my (worker earnings)
router.get('/my', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, j.title as job_title, j.customer_id,
              u.full_name as customer_name
       FROM payments p
       JOIN jobs j ON j.id = p.job_id
       JOIN users u ON u.id = j.customer_id
       WHERE j.assigned_worker_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    const total = result.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    res.json({ payments: result.rows, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
