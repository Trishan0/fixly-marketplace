-- ============================================================
-- Migration 014: Worker AI Matching Opt-In
-- Lets a worker exclude themselves from the Match Agent's candidate pool.
-- Defaults true so existing behavior (everyone currently visible) doesn't
-- change for anyone until they actively decide otherwise.
-- ============================================================

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS ai_matching_opt_in BOOLEAN NOT NULL DEFAULT true;
