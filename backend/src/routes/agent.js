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
const pool = require('../db');
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
    const existing = await pool.query(
      `SELECT id, status FROM agent_runs
       WHERE user_id = $1 AND job_id = $2 AND status IN ('running', 'awaiting_confirmation')
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, job_id]
    );

    if (existing.rows[0]) {
      return res.status(409).json({
        error: 'An agent run is already active for this job',
        run_id: existing.rows[0].id,
        status: existing.rows[0].status,
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
    const existing = await pool.query(
      `SELECT id, status FROM agent_runs
       WHERE user_id = $1 AND agent_type = 'proposal' AND status IN ('running', 'awaiting_confirmation')
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (existing.rows[0]) {
      return res.status(409).json({
        error: 'A proposal agent run is already active',
        run_id: existing.rows[0].id,
        status: existing.rows[0].status,
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
    const runResult = await pool.query(
      `SELECT * FROM agent_runs WHERE id = $1 AND user_id = $2`,
      [runId, req.user.id]
    );
    if (!runResult.rows[0]) return res.status(404).json({ error: 'Run not found' });
    const run = runResult.rows[0];

    const stepsResult = await pool.query(
      `SELECT * FROM agent_run_steps WHERE run_id = $1 ORDER BY step_index ASC`,
      [runId]
    );

    const recsResult = await pool.query(
      `SELECT ar.*,
              CASE ar.entity_type
                WHEN 'worker' THEN (
                  SELECT json_build_object(
                    'id', u.id,
                    'full_name', u.full_name,
                    'district', u.district,
                    'profile_photo', u.profile_photo,
                    'is_nic_verified', u.is_nic_verified,
                    'avg_rating', wp.avg_rating,
                    'total_jobs_done', wp.total_jobs_done,
                    'primary_skill', wp.primary_skill,
                    'starting_price', wp.starting_price
                  )
                  FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id
                  WHERE u.id = ar.entity_id
                )
                WHEN 'job' THEN (
                  SELECT json_build_object(
                    'id', j.id,
                    'title', j.title,
                    'district', j.district,
                    'urgency', j.urgency,
                    'pricing_mode', j.pricing_mode,
                    'fixed_budget', j.fixed_budget,
                    'category_name', c.name,
                    'status', j.status
                  )
                  FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
                  WHERE j.id = ar.entity_id
                )
              END AS entity_data
       FROM agent_recommendations ar
       WHERE ar.run_id = $1
       ORDER BY ar.rank ASC`,
      [runId]
    );

    res.json({
      run,
      steps: stepsResult.rows,
      recommendations: recsResult.rows,
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
    let query = `
      SELECT ar.*,
             CASE WHEN ar.job_id IS NOT NULL THEN
               (SELECT title FROM jobs WHERE id = ar.job_id)
             END AS job_title,
             (SELECT COUNT(*) FROM agent_recommendations WHERE run_id = ar.id) AS recommendation_count
      FROM agent_runs ar
      WHERE ar.user_id = $1
    `;
    const params = [req.user.id];
    let idx = 2;

    if (agent_type) {
      query += ` AND ar.agent_type = $${idx}`;
      params.push(agent_type);
      idx++;
    }

    query += ` ORDER BY ar.created_at DESC LIMIT $${idx}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
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
    const result = await pool.query(
      `UPDATE agent_runs SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running', 'awaiting_confirmation')
       RETURNING id`,
      [runId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Run not found or already completed' });
    res.json({ message: 'Run cancelled', run_id: runId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

module.exports = router;
