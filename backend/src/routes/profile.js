const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { deleteStoredFile, uploadedPath } = require('../services/storage');
const { MarketplaceError } = require('../modules/marketplace/errors');
const identity = require('../modules/identity/service');
const repository = identity.repository;
const router = express.Router();
function respond(error, res) { if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code }); console.error(error); return res.status(500).json({ error: 'Failed' }); }

router.get('/me', verifyToken, async (req, res) => { try { const user = await repository.selfProfile(req.user.id); if (!user) return res.status(404).json({ error: 'User not found' }); if (user.role === 'worker') { const worker = await repository.workerProfileId(req.user.id); user.portfolio_photos = worker ? await repository.workerPortfolio(worker.id) : []; user.skills = await repository.workerSkills(req.user.id); } res.json(user); } catch (error) { respond(error, res); } });
router.put('/me', verifyToken, async (req, res) => { try { await identity.updateOwnProfile(req.user, req.body); res.json({ message: 'Profile updated' }); } catch (error) { respond(error, res); } });
router.post('/photo', verifyToken, upload.single('photo'), async (req, res) => { try { const path = uploadedPath({ req, kind: 'profile', userId: req.user.id }); const previous = await repository.selfProfile(req.user.id); await repository.setProfilePhoto(req.user.id, path); deleteStoredFile(previous?.profile_photo, 'profile').catch(error => console.warn('Old profile photo cleanup failed:', error.message)); res.json({ path }); } catch (error) { res.status(400).json({ error: error.message }); } });
router.post('/nic-upload', verifyToken, upload.single('nic_image'), async (req, res) => { try { const path = uploadedPath({ req, kind: 'nic', userId: req.user.id }); await repository.setNicImage(req.user.id, path); res.json({ message: 'NIC uploaded, pending verification' }); } catch (error) { res.status(400).json({ error: error.message }); } });
router.put('/dashboard-mode', verifyToken, requireRole('worker'), async (req, res) => { if (!['standard', 'simplified'].includes(req.body.mode)) return res.status(400).json({ error: 'Invalid mode' }); try { await repository.setDashboardMode(req.user.id, req.body.mode); res.json({ message: 'Dashboard mode updated', mode: req.body.mode }); } catch (error) { respond(error, res); } });
router.post('/portfolio', verifyToken, requireRole('worker'), upload.single('photo'), async (req, res) => { try { const path = uploadedPath({ req, kind: 'portfolio', userId: req.user.id }); res.json(await identity.addPortfolioPhoto(req.user.id, path)); } catch (error) { respond(error, res); } });
router.delete('/portfolio/:photoId', verifyToken, requireRole('worker'), async (req, res) => { try { const deleted = await identity.removePortfolioPhoto(req.user.id, req.params.photoId); deleteStoredFile(deleted.path, 'portfolio').catch(error => console.warn('Portfolio cleanup failed:', error.message)); res.json({ message: 'Photo deleted' }); } catch (error) { respond(error, res); } });
module.exports = router;
