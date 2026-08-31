const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { createReview } = require('../modules/marketplace/service');

router.post('/jobs/:jobId/review', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const review = await createReview({ jobId: req.params.jobId, customerId: req.user.id, input: req.body });
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error(error);
    return res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
