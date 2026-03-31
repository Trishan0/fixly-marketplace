const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

// PUT /api/proposals/:id/accept
router.put('/:id/accept', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const propResult = await pool.query(
      `SELECT p.*, j.customer_id, j.status as job_status, j.title as job_title
       FROM proposals p JOIN jobs j ON j.id = p.job_id WHERE p.id = $1`,
      [req.params.id]
    );
    const proposal = propResult.rows[0];
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.customer_id !== req.user.id) return res.status(403).json({ error: 'Not your job' });
    if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposal is not pending' });

    // Accept this proposal
    await pool.query(`UPDATE proposals SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    // Decline all others
    await pool.query(
      `UPDATE proposals SET status = 'declined', updated_at = NOW() 
       WHERE job_id = $1 AND id != $2 AND status = 'pending'`,
      [proposal.job_id, req.params.id]
    );
    // Update job
    await pool.query(
      `UPDATE jobs SET status = 'assigned', assigned_worker_id = $1, updated_at = NOW() WHERE id = $2`,
      [proposal.worker_id, proposal.job_id]
    );

    await createNotification(
      proposal.worker_id, 'proposal_accepted', 'Proposal Accepted!',
      `Your proposal for "${proposal.job_title}" was accepted!`,
      { job_id: proposal.job_id }
    );

    res.json({ message: 'Proposal accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/proposals/:id/decline
router.put('/:id/decline', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const propResult = await pool.query(
      `SELECT p.*, j.customer_id, j.title as job_title FROM proposals p JOIN jobs j ON j.id = p.job_id WHERE p.id = $1`,
      [req.params.id]
    );
    const proposal = propResult.rows[0];
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.customer_id !== req.user.id) return res.status(403).json({ error: 'Not your job' });

    await pool.query(`UPDATE proposals SET status = 'declined', updated_at = NOW() WHERE id = $1`, [req.params.id]);

    await createNotification(
      proposal.worker_id, 'proposal_declined', 'Proposal Declined',
      `Your proposal for "${proposal.job_title}" was declined.`,
      { job_id: proposal.job_id }
    );

    res.json({ message: 'Proposal declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/proposals/:id/withdraw
router.put('/:id/withdraw', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const propResult = await pool.query('SELECT * FROM proposals WHERE id = $1 AND worker_id = $2', [req.params.id, req.user.id]);
    if (!propResult.rows[0]) return res.status(404).json({ error: 'Proposal not found' });

    await pool.query(`UPDATE proposals SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Proposal withdrawn' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
