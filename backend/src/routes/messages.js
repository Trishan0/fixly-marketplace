const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { MarketplaceError } = require('../modules/marketplace/errors');
const messaging = require('../modules/messaging/service');

const router = express.Router();
const sendLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, keyPrefix: 'messages-send', message: 'You are sending messages too quickly. Please wait a moment.' });

function respond(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

// GET /api/messages/conversations - the user's threads, newest first
router.get('/conversations', verifyToken, async (req, res) => {
  try { res.json(await messaging.listConversations(req.user)); } catch (error) { respond(error, res); }
});

// GET /api/messages/unread-count
router.get('/unread-count', verifyToken, async (req, res) => {
  try { res.json({ unread: await messaging.unreadCount(req.user) }); } catch (error) { respond(error, res); }
});

// GET /api/messages/:jobId/:workerId - thread details and messages; marks them read
router.get('/:jobId/:workerId', verifyToken, async (req, res) => {
  try { res.json(await messaging.getThread(req.user, req.params.jobId, req.params.workerId)); } catch (error) { respond(error, res); }
});

// POST /api/messages/:jobId/:workerId { body }
router.post('/:jobId/:workerId', verifyToken, sendLimiter, async (req, res) => {
  try { res.status(201).json(await messaging.sendMessage(req.user, req.params.jobId, req.params.workerId, req.body)); } catch (error) { respond(error, res); }
});

module.exports = router;
