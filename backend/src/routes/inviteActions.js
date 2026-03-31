const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createNotification } = require('../services/notificationDispatch');

// GET /api/invites/received
router.get('/received', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, j.title as job_title, j.district, j.urgency, j.pricing_mode, j.fixed_budget,
              j.status as job_status, j.category_id,
              c.name as category_name, c.icon as category_icon,
              u.full_name as customer_name, u.profile_photo as customer_photo
       FROM invites i
       JOIN jobs j ON j.id = i.job_id
       LEFT JOIN categories c ON c.id = j.category_id
       JOIN users u ON u.id = i.customer_id
       WHERE i.worker_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/invites/:id/accept
router.put('/:id/accept', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const inviteResult = await pool.query(
      `SELECT i.*, j.title as job_title, j.status as job_status
       FROM invites i JOIN jobs j ON j.id = i.job_id
       WHERE i.id = $1 AND i.worker_id = $2`,
      [req.params.id, req.user.id]
    );
    const invite = inviteResult.rows[0];
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite already responded to' });

    await pool.query(`UPDATE invites SET status = 'accepted' WHERE id = $1`, [req.params.id]);

    // Auto-create proposal
    const existing = await pool.query(
      'SELECT id FROM proposals WHERE job_id = $1 AND worker_id = $2',
      [invite.job_id, req.user.id]
    );
    if (!existing.rows[0]) {
      await pool.query(
        `INSERT INTO proposals (job_id, worker_id, message) VALUES ($1, $2, $3)`,
        [invite.job_id, req.user.id, 'Accepted via invite']
      );
      // Transition job if needed
      const jobResult = await pool.query('SELECT status FROM jobs WHERE id = $1', [invite.job_id]);
      if (jobResult.rows[0].status === 'posted') {
        await pool.query(`UPDATE jobs SET status = 'proposals_received', updated_at = NOW() WHERE id = $1`, [invite.job_id]);
      }
    }

    await createNotification(
      invite.customer_id, 'invite_accepted', 'Invite Accepted',
      `A worker accepted your invite for: ${invite.job_title}`,
      { job_id: invite.job_id }
    );

    res.json({ message: 'Invite accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/invites/:id/decline
router.put('/:id/decline', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE invites SET status = 'declined' WHERE id = $1 AND worker_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Invite not found' });
    res.json({ message: 'Invite declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
