const express = require('express');
const router = express.Router({ mergeParams: true });
const { verifyToken, requireRole } = require('../middleware/auth');
const { maskPrice } = require('../services/priceVisibility');
const repository = require('../modules/marketplace/repository');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { submitProposal } = require('../modules/marketplace/service');

// POST /api/jobs/:jobId/proposals
router.post('/', verifyToken, requireRole('worker'), async (req, res) => {
  const { jobId } = req.params;
  try {
    const proposal = await submitProposal({ jobId, worker: req.user, input: req.body });
    res.status(201).json(proposal);
  } catch (err) {
    if (err instanceof MarketplaceError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/jobs/:jobId/proposals
router.get('/', verifyToken, async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await repository.findJobById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only job owner and workers can view
    if (req.user.role === 'customer' && req.user.id !== job.customer_id) {
      return res.status(403).json({ error: 'Not your job' });
    }

    const proposals = maskPrice(
      await repository.listJobProposals(jobId, req.user.role === 'worker' ? req.user.id : null),
      req.user.id,
      job.customer_id,
      job.status
    );

    res.json(proposals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
