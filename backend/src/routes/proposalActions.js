const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { acceptProposal, declineProposal, listWorkerProposals, updateProposal, withdrawProposal } = require('../modules/marketplace/service');

function respond(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

// GET /api/proposals/mine?status=&page=&limit= - the worker's proposals with job context
router.get('/mine', verifyToken, requireRole('worker'), async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  try {
    res.json(await listWorkerProposals({ workerId: req.user.id, status: req.query.status || null, page, limit }));
  } catch (err) {
    respond(err, res);
  }
});

// PUT /api/proposals/:id - edit a pending proposal (price, availability, message)
router.put('/:id', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    res.json(await updateProposal({ proposalId: req.params.id, worker: req.user, input: req.body }));
  } catch (err) {
    respond(err, res);
  }
});

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
