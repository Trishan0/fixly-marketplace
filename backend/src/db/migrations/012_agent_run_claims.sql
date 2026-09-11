-- ============================================================
-- Migration 012: Agent Run Claims
-- Supports moving agent execution off the synchronous request path onto
-- an in-process polling worker. claimed_at marks when a run was picked up
-- so a crashed process's stuck 'running' rows can be reclaimed instead of
-- staying stuck forever.
-- ============================================================

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
