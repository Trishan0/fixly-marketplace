const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const repository = require('../modules/marketplace/repository');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { acceptInvitation, declineInvitation } = require('../modules/marketplace/service');

function respond(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

// GET /api/invites/received
router.get('/received', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    res.json(await repository.listReceivedInvites(req.user.id));
  } catch (err) {
    respond(err, res);
  }
});

// PUT /api/invites/:id/accept
router.put('/:id/accept', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const result = await acceptInvitation({ inviteId: req.params.id, worker: req.user });
    res.json({ message: result.alreadyAccepted ? 'Invite already accepted' : 'Invite accepted' });
  } catch (err) {
    respond(err, res);
  }
});

// PUT /api/invites/:id/decline
router.put('/:id/decline', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    await declineInvitation({ inviteId: req.params.id, workerId: req.user.id });
    res.json({ message: 'Invite declined' });
  } catch (err) {
    respond(err, res);
  }
});

module.exports = router;
