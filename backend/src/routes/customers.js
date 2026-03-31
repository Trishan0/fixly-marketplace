const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const customerResult = await pool.query(
      `SELECT id, full_name, district, area, profile_photo, created_at
       FROM users
       WHERE id = $1 AND role = 'customer' AND is_suspended = false`,
      [req.params.id]
    );

    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [jobsPosted, jobsCompleted, reviewsGiven] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM jobs WHERE customer_id = $1', [req.params.id]),
      pool.query(
        `SELECT COUNT(*) FROM jobs
         WHERE customer_id = $1 AND status IN ('completed', 'payment_recorded', 'reviewed')`,
        [req.params.id]
      ),
      pool.query('SELECT COUNT(*) FROM reviews WHERE customer_id = $1', [req.params.id]),
    ]);

    res.json({
      ...customer,
      jobs_posted: parseInt(jobsPosted.rows[0].count, 10),
      jobs_completed: parseInt(jobsCompleted.rows[0].count, 10),
      reviews_given: parseInt(reviewsGiven.rows[0].count, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

module.exports = router;
