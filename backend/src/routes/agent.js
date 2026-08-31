/**
 * agent.js — API routes for the Fixly AI Agent system.
 *
 * POST /api/agent/match/run        — customer runs match agent on a job
 * POST /api/agent/proposal/run     — worker runs proposal agent
 * POST /api/agent/run/:id/confirm  — confirm a pending agent action
 * GET  /api/agent/run/:id          — get run details
 * GET  /api/agent/history          — get recent runs for current user
 */

const express = require('express');
const router = express.Router();
const repository = require('../modules/agents/repository');
const { verifyToken, requireRole } = require('../middleware/auth');
const { runMatchAgent, confirmMatchAgent } = require('../agents/matchAgent');
const { runProposalAgent, confirmProposalAgent } = require('../agents/proposalAgent');
const { MarketplaceError } = require('../modules/marketplace/errors');

// ── POST /api/agent/match/run ─────────────────────────────────────────────────
// Customer triggers the match agent for a specific job.
router.post('/match/run', verifyToken, requireRole('customer'), async (req, res) => {
  const { job_id } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  try {
    // Check if there's already a running/awaiting run for this job to avoid duplicates
    const existing = await repository.activeMatch(req.user.id, job_id);
    if (existing) {
      return res.status(409).json({
        error: 'An agent run is already active for this job',
        run_id: existing.id,
        status: existing.status,
      });
    }

    const result = await runMatchAgent(job_id, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    console.error('[agent/match/run]', err.message);
    if (err.message === 'Job not found') return res.status(404).json({ error: err.message });
    if (err.message === 'Not your job') return res.status(403).json({ error: err.message });
    res.status(500).json({ error: 'Agent run failed: ' + err.message });
  }
});

// ── POST /api/agent/proposal/run ─────────────────────────────────────────────
// Worker triggers the proposal agent.
router.post('/proposal/run', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    // Prevent duplicate active runs
    const existing = await repository.activeProposal(req.user.id);
    if (existing) {
      return res.status(409).json({
        error: 'A proposal agent run is already active',
        run_id: existing.id,
        status: existing.status,
      });
    }

    const result = await runProposalAgent(req.user.id);
    res.status(201).json(result);
  } catch (err) {
    console.error('[agent/proposal/run]', err.message);
    res.status(500).json({ error: 'Agent run failed: ' + err.message });
  }
});

// ── POST /api/agent/run/:id/confirm ──────────────────────────────────────────
// Confirm a pending agent action.
// Body: { action_type: 'invite'|'proposal', selections: [...] }
//   For 'invite':   selections = [workerId, workerId, ...]
//   For 'proposal': selections = [{ job_id, message, proposed_price, ... }, ...]
router.post('/run/:id/confirm', verifyToken, async (req, res) => {
  const { id: runId } = req.params;
  const { action_type, selections } = req.body;

  if (!action_type || !['invite', 'proposal'].includes(action_type)) {
    return res.status(400).json({ error: "action_type must be 'invite' or 'proposal'" });
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: 'selections array is required and must not be empty' });
  }

  try {
    let result;

    if (action_type === 'invite') {
      if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Only customers can confirm invites' });
      }
      result = await confirmMatchAgent(runId, req.user.id, selections);
    } else {
      if (req.user.role !== 'worker') {
        return res.status(403).json({ error: 'Only workers can confirm proposals' });
      }
      result = await confirmProposalAgent(runId, req.user.id, selections);
    }

    res.json(result);
  } catch (err) {
    console.error('[agent/confirm]', err.message);
    if (err instanceof MarketplaceError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    if (err.message.includes('not awaiting')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Confirmation failed: ' + err.message });
  }
});

// ── GET /api/agent/run/:id ────────────────────────────────────────────────────
// Get full run details: run record + steps + recommendations
router.get('/run/:id', verifyToken, async (req, res) => {
  const { id: runId } = req.params;

  try {
    const run = await repository.runDetail(runId, req.user.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const [steps, recommendations] = await Promise.all([repository.runSteps(runId), repository.runRecommendations(runId)]);

    res.json({
      run,
      steps,
      recommendations,
    });
  } catch (err) {
    console.error('[agent/run/:id]', err.message);
    res.status(500).json({ error: 'Failed to load run' });
  }
});

// ── GET /api/agent/history ────────────────────────────────────────────────────
// Get recent agent runs for the authenticated user.
router.get('/history', verifyToken, async (req, res) => {
  const { limit = 10, agent_type } = req.query;

  try {
    const boundedLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
    res.json(await repository.history(req.user.id, ['match', 'proposal'].includes(agent_type) ? agent_type : null, boundedLimit));
  } catch (err) {
    console.error('[agent/history]', err.message);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ── POST /api/agent/run/:id/cancel ───────────────────────────────────────────
// Cancel a pending or awaiting_confirmation run.
router.post('/run/:id/cancel', verifyToken, async (req, res) => {
  const { id: runId } = req.params;
  try {
    const result = await repository.cancelRun(runId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Run not found or already completed' });
    res.json({ message: 'Run cancelled', run_id: runId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

module.exports = router;
