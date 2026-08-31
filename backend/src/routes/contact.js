const express = require('express');
const { z } = require('zod');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendContactEmail } = require('../services/emailService');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(255).transform(value => value.toLowerCase()),
  topic: z.enum(['Getting started', 'Customer support', 'Worker support', 'Demo or project enquiry', 'Other']),
  message: z.string().trim().min(20, 'Please provide a little more detail').max(3000),
  website: z.string().max(0).optional(),
});

const contactLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: 'contact-form',
  message: 'Too many messages sent from this connection. Please try again later.',
});

router.post('/', contactLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contact message' });
  if (parsed.data.website) return res.status(200).json({ message: 'Message received' });

  try {
    await sendContactEmail(parsed.data);
    return res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Contact email failed:', error.message);
    return res.status(503).json({ error: 'Unable to send your message right now. Please try again shortly.' });
  }
});

module.exports = router;
