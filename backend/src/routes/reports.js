const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// POST /api/reports
router.post('/', verifyToken, async (req, res) => {
  const { reported_user_id, job_id, report_type, description } = req.body;
  if (!report_type || !description) return res.status(400).json({ error: 'Type and description required' });

  try {
    const result = await pool.query(
      `INSERT INTO reports (reporter_id, reported_user_id, job_id, report_type, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, reported_user_id, job_id, report_type, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/reports/my
router.get('/my', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.full_name as reported_user_name, j.title as job_title
       FROM reports r
       LEFT JOIN users u ON u.id = r.reported_user_id
       LEFT JOIN jobs j ON j.id = r.job_id
       WHERE r.reporter_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
