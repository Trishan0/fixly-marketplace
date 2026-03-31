const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

// POST /api/jobs/:jobId/payment
router.post('/jobs/:jobId/payment', verifyToken, requireRole('customer'), async (req, res) => {
  const { amount, method, note } = req.body;
  if (!method) return res.status(400).json({ error: 'Payment method required' });

  try {
    const jobResult = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [req.params.jobId, req.user.id]
    );
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job must be completed first' });
    const paymentAmount = amount || job.final_price;
    if (!paymentAmount) return res.status(400).json({ error: 'Set the final price or enter an amount first' });

    const result = await pool.query(
      `INSERT INTO payments (job_id, amount, method, note, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.jobId, paymentAmount, method, note, req.user.id]
    );

    await pool.query(
      `UPDATE jobs SET status = 'payment_recorded', final_price = $1, updated_at = NOW() WHERE id = $2`,
      [paymentAmount, req.params.jobId]
    );

    if (job.assigned_worker_id) {
      await createNotification(
        job.assigned_worker_id, 'payment_recorded', 'Payment Recorded',
        `Customer recorded a payment of LKR ${Number(paymentAmount).toLocaleString()} for: ${job.title}`,
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
    const paymentCheck = await pool.query(
      `SELECT p.*, j.customer_id, j.title as job_title, j.assigned_worker_id, j.id as job_id
       FROM payments p
       JOIN jobs j ON j.id = p.job_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    const payment = paymentCheck.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.assigned_worker_id !== req.user.id) return res.status(403).json({ error: 'Not your payment' });

    await pool.query(`UPDATE payments SET worker_confirmed = true WHERE id = $1`, [req.params.id]);

    await createNotification(
      payment.customer_id, 'payment_confirmed', 'Payment Confirmed',
      `Worker confirmed payment for: ${payment.job_title}`,
      { job_id: payment.job_id }
    );

    res.json({ message: 'Payment confirmed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/payments/:id/dispute
router.put('/:id/dispute', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const paymentCheck = await pool.query(
      `SELECT p.*, j.customer_id, j.title as job_title, j.assigned_worker_id, j.id as job_id
       FROM payments p
       JOIN jobs j ON j.id = p.job_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    const payment = paymentCheck.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.assigned_worker_id !== req.user.id) return res.status(403).json({ error: 'Not your payment' });

    await pool.query(`UPDATE payments SET disputed = true WHERE id = $1`, [req.params.id]);

    await createNotification(
      payment.customer_id, 'payment_disputed', 'Payment Disputed',
      `Worker has disputed the payment for: ${payment.job_title}`,
      { job_id: payment.job_id }
    );

    res.json({ message: 'Payment disputed' });
  } catch (err) {
    console.error(err);
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
    const confirmedTotal = result.rows
      .filter(r => r.worker_confirmed)
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const pendingTotal = result.rows
      .filter(r => !r.worker_confirmed && !r.disputed)
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const disputedTotal = result.rows
      .filter(r => r.disputed)
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    res.json({ payments: result.rows, total, confirmedTotal, pendingTotal, disputedTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
