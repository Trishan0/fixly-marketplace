-- ============================================================
-- Migration 013: Agent Run Read Model
-- Moving agent execution off the request path (see worker.js) means the
-- client now learns a run's outcome via GET /agent/run/:id instead of the
-- original POST response. Several fields the UI needs were previously
-- only ever held in that in-memory POST response and never persisted -
-- this migration adds columns so the read path carries everything the
-- write path used to hand back directly.
-- ============================================================

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS overall_reasoning TEXT;

ALTER TABLE agent_recommendations
  ADD COLUMN IF NOT EXISTS key_strengths JSONB,
  ADD COLUMN IF NOT EXISTS proposal_draft TEXT;
