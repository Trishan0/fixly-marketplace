-- ============================================================
-- Migration 011: Agent Run Telemetry
-- Tracks which engine actually produced an agent run's recommendations
-- (Gemini tool-calling loop vs. the deterministic scoring fallback) plus
-- basic cost/latency signal for the Gemini path, so it stops being a
-- silent, unobservable branch.
-- ============================================================

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS engine            VARCHAR(20) CHECK (engine IN ('gemini', 'deterministic')),
  ADD COLUMN IF NOT EXISTS model_used        VARCHAR(60),
  ADD COLUMN IF NOT EXISTS latency_ms        INT,
  ADD COLUMN IF NOT EXISTS prompt_tokens     INT,
  ADD COLUMN IF NOT EXISTS completion_tokens INT,
  ADD COLUMN IF NOT EXISTS total_tokens      INT,
  ADD COLUMN IF NOT EXISTS iteration_count   INT;
