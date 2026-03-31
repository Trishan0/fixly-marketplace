const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = result.rows.filter(n => !n.is_read).length;
    res.json({ notifications: result.rows, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ message: 'All marked as read' });
});

module.exports = router;
