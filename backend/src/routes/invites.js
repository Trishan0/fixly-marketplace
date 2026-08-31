const express = require('express');
const router = express.Router({ mergeParams: true });
const { verifyToken, requireRole } = require('../middleware/auth');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { createInvitation } = require('../modules/marketplace/service');

// POST /api/jobs/:jobId/invites
router.post('/', verifyToken, requireRole('customer'), async (req, res) => {
  const { jobId } = req.params;
  const { worker_id, message } = req.body;

  try {
    const { invite, alreadyExists } = await createInvitation({
      jobId,
      customerId: req.user.id,
      input: { worker_id, message },
    });
    if (alreadyExists) return res.status(409).json({ error: 'Already invited this worker' });
    res.status(201).json(invite);
  } catch (err) {
    if (err instanceof MarketplaceError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
