const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { MarketplaceError } = require('../modules/marketplace/errors');
const identity = require('../modules/identity/service');

const router = express.Router();
const authWriteLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'auth-write', message: 'Too many authentication attempts, please try again later' });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'forgot-password', message: 'Too many reset requests, please try again later' });
function signToken(user) { return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); }
function respond(error, res, fallback) { if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code }); console.error(error); return res.status(500).json({ error: fallback }); }
function publicAuthUser(user) { return { id: user.id, email: user.email, role: user.role, full_name: user.full_name, is_email_verified: user.is_email_verified, force_verified: user.force_verified, dashboard_mode: user.dashboard_mode, profile_photo: user.profile_photo, district: user.district }; }

router.post('/register', authWriteLimiter, async (req, res) => { try { const { user, rawVerifyToken, email } = await identity.register(req.body); sendVerificationEmail(email, rawVerifyToken).catch(error => console.error('Verification email failed:', error.message)); res.status(201).json({ token: signToken(user), user }); } catch (error) { respond(error, res, 'Registration failed'); } });
router.post('/login', authWriteLimiter, async (req, res) => { try { const user = await identity.authenticate(req.body); res.json({ token: signToken(user), user: publicAuthUser(user) }); } catch (error) { respond(error, res, 'Login failed'); } });
router.post('/verify-email/:token', async (req, res) => { try { await identity.verifyEmail(req.params.token); res.json({ message: 'Email verified successfully' }); } catch (error) { respond(error, res, 'Verification failed'); } });
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => { try { const reset = await identity.requestPasswordReset(req.body); if (reset) sendPasswordResetEmail(reset.email, reset.rawToken).catch(error => console.error('Password reset email failed:', error.message)); res.json({ message: 'If account exists, reset email sent' }); } catch (error) { respond(error, res, 'Failed'); } });
router.post('/reset-password', authWriteLimiter, async (req, res) => { try { await identity.completePasswordReset(req.body); res.json({ message: 'Password reset successfully' }); } catch (error) { respond(error, res, 'Failed'); } });
router.get('/me', verifyToken, async (req, res) => { try { const user = await identity.repository.selfProfile(req.user.id); if (!user) return res.status(404).json({ error: 'User not found' }); res.json(user); } catch (error) { respond(error, res, 'Failed'); } });
module.exports = router;
