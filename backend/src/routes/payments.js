const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const repository = require('../modules/marketplace/repository');
const { MarketplaceError } = require('../modules/marketplace/errors');
const { changePaymentState, recordPayment } = require('../modules/marketplace/service');

function respond(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

router.post('/jobs/:jobId/payment', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const payment = await recordPayment({ jobId: req.params.jobId, customerId: req.user.id, input: req.body });
    res.status(201).json(payment);
  } catch (error) {
    respond(error, res);
  }
});

router.put('/:id/confirm', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    await changePaymentState({ paymentId: req.params.id, workerId: req.user.id, targetStatus: 'confirmed' });
    res.json({ message: 'Payment confirmed' });
  } catch (error) {
    respond(error, res);
  }
});

router.put('/:id/dispute', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    await changePaymentState({ paymentId: req.params.id, workerId: req.user.id, targetStatus: 'disputed' });
    res.json({ message: 'Payment disputed' });
  } catch (error) {
    respond(error, res);
  }
});

router.get('/my', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const { payments, totals } = await repository.workerEarnings(req.user.id);
    res.json({
      payments,
      total: totals.total,
      confirmedTotal: totals.confirmed_total,
      pendingTotal: totals.pending_total,
      disputedTotal: totals.disputed_total,
    });
  } catch (error) {
    respond(error, res);
  }
});

module.exports = router;
