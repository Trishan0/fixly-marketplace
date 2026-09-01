const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { withTransaction } = require('../../db/transaction');
const { classifyDatabaseError } = require('../../db/errors');
const { createRawToken, hashToken, expiresInHours } = require('../../services/authTokens');
const repository = require('./repository');
const { MarketplaceError, badRequest, conflict, notFound } = require('../marketplace/errors');

const email = z.string().trim().email().max(255).transform(value => value.toLowerCase());
const password = z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/);
const registration = z.object({ full_name: z.string().trim().min(2).max(255), email, password,
  phone: z.string().trim().max(20).optional().nullable(), role: z.enum(['customer', 'worker']),
  district: z.string().trim().max(100).optional().nullable(), area: z.string().trim().max(100).optional().nullable(),
  primary_skill: z.string().trim().max(100).optional().nullable(), dashboard_mode: z.enum(['standard', 'simplified']).default('standard') });
const profile = z.object({ full_name: z.string().trim().min(2).max(255).optional(), phone: z.string().trim().max(20).nullable().optional(), district: z.string().trim().max(100).nullable().optional(), area: z.string().trim().max(100).nullable().optional(), bio: z.string().trim().max(10_000).nullable().optional(), starting_price: z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable().optional(), primary_skill: z.string().trim().max(100).nullable().optional() });
function parse(schema, input) { const result = schema.safeParse(input); if (!result.success) throw badRequest(result.error.issues[0].message); return result.data; }
function translate(error) { if (error instanceof MarketplaceError) throw error; if (classifyDatabaseError(error).code === 'CONFLICT') throw conflict('A conflicting identity record already exists'); throw error; }

async function register(input) {
  const data = parse(registration, input); const rawVerifyToken = createRawToken();
  try { const user = await withTransaction(async ({ tx }) => {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const created = await repository.insertUser({ fullName: data.full_name, email: data.email, passwordHash, phone: data.phone || null, role: data.role, district: data.district || null, area: data.area || null, verifyTokenHash: hashToken(rawVerifyToken), verifyExpiresAt: expiresInHours(24), dashboardMode: data.dashboard_mode }, tx);
    if (data.role === 'worker') { const worker = await repository.createWorkerProfile(created.id, data.primary_skill || null, tx); if (data.primary_skill) { const category = await repository.findCategoryByName(data.primary_skill, tx); if (category) await repository.insertWorkerSkill(worker.id, category.id, tx); } }
    return created;
  }, { isolationLevel: 'serializable', maxRetries: 2 }); return { user, rawVerifyToken, email: data.email }; } catch (error) { translate(error); }
}
async function updateOwnProfile(user, input) { const data = parse(profile, input); try { return await withTransaction(async ({ tx }) => { await repository.updateProfile({ userId: user.id, fullName: data.full_name, phone: data.phone, district: data.district, area: data.area }, tx); if (user.role === 'worker') await repository.updateWorkerProfile({ userId: user.id, bio: data.bio, startingPrice: data.starting_price, primarySkill: data.primary_skill }, tx); }, { isolationLevel: 'serializable', maxRetries: 2 }); } catch (error) { translate(error); } }
async function addPortfolioPhoto(userId, path) { try { return await withTransaction(async ({ tx }) => { const worker = await repository.workerProfileId(userId, tx); if (!worker) throw notFound('Worker profile not found'); const count = await repository.portfolioCount(worker.id, tx); if (count.count >= 10) throw badRequest('Maximum 10 portfolio photos allowed'); return repository.insertPortfolioPhoto(worker.id, path, tx); }, { isolationLevel: 'serializable', maxRetries: 2 }); } catch (error) { translate(error); } }
async function removePortfolioPhoto(userId, photoId) { try { return await withTransaction(async ({ tx }) => { const worker = await repository.workerProfileId(userId, tx); if (!worker) throw notFound('Worker profile not found'); const deleted = await repository.deletePortfolioPhoto(photoId, worker.id, tx); if (!deleted) throw notFound('Portfolio photo not found'); return deleted; }, { isolationLevel: 'serializable', maxRetries: 2 }); } catch (error) { translate(error); } }
async function authenticate(input) { const data = parse(z.object({ email, password: z.string().min(1).max(200) }), input); const user = await repository.findAuthUserByEmail(data.email); if (!user || !(await bcrypt.compare(data.password, user.password_hash))) throw new MarketplaceError('Invalid credentials', { status: 401, code: 'INVALID_CREDENTIALS' }); if (user.is_suspended) throw new MarketplaceError('Account suspended', { status: 403, code: 'SUSPENDED' }); return user; }
async function verifyEmail(token) { const result = await repository.verifyEmail(hashToken(token)); if (!result) throw badRequest('Invalid or expired verification token'); }
async function requestPasswordReset(input) { const data = parse(z.object({ email }), input); const user = await repository.findResetEligibleUser(data.email); if (!user || user.is_suspended) return null; const rawToken = createRawToken(); await repository.setPasswordResetToken(data.email, hashToken(rawToken), expiresInHours(1)); return { email: data.email, rawToken }; }
async function completePasswordReset(input) { const data = parse(z.object({ token: z.string().min(16).max(255), password }), input); const result = await repository.resetPassword(hashToken(data.token), await bcrypt.hash(data.password, 12)); if (!result) throw badRequest('Invalid or expired token'); }
module.exports = { addPortfolioPhoto, authenticate, completePasswordReset, email, parse, password, register, removePortfolioPhoto, repository, requestPasswordReset, updateOwnProfile, verifyEmail };
