-- ============================================================
-- Migration 018: Match agent lanes
-- * agent_recommendations.lane - which part of a match result a worker
--   was shown in: 'best_match' (proven workers) or 'new_talent' (verified
--   workers with fewer than 3 completed jobs). NULL for proposal runs.
-- * worker_profiles.updated_at - when the worker last improved their
--   profile; it resets their place in the new-talent rotation.
-- * An index for counting how often each worker has been recommended.
-- ============================================================

ALTER TABLE agent_recommendations
  ADD COLUMN IF NOT EXISTS lane VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_recommendations_lane_check') THEN
    ALTER TABLE agent_recommendations
      ADD CONSTRAINT agent_recommendations_lane_check
      CHECK (lane IS NULL OR lane IN ('best_match', 'new_talent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_recommendations_entity_created
  ON agent_recommendations (entity_type, entity_id, created_at DESC);

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
