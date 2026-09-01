const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { acceptProposal, declineProposal, withdrawProposal } = require('../modules/marketplace/service');

function respond(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

// PUT /api/proposals/:id/accept
router.put('/:id/accept', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    await acceptProposal({ proposalId: req.params.id, customerId: req.user.id });
    res.json({ message: 'Proposal accepted' });
  } catch (err) {
    respond(err, res);
  }
});

// PUT /api/proposals/:id/decline
router.put('/:id/decline', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    await declineProposal({ proposalId: req.params.id, customerId: req.user.id });
    res.json({ message: 'Proposal declined' });
  } catch (err) {
    respond(err, res);
  }
});

// PUT /api/proposals/:id/withdraw
router.put('/:id/withdraw', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    await withdrawProposal({ proposalId: req.params.id, workerId: req.user.id });
    res.json({ message: 'Proposal withdrawn' });
  } catch (err) {
    respond(err, res);
  }
});

module.exports = router;
