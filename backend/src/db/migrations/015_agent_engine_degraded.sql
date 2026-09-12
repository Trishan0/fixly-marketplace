-- ============================================================
-- Migration 015: Agent Engine Degraded State
-- Adds 'degraded' as an allowed agent_runs.engine value: when Gemini
-- fails entirely (not merely unconfigured - see createMatchRun/
-- createProposalRun's fast-fail for that case), the run now falls
-- through to an honestly-labeled rating-based list instead of a hard
-- error, so the feature stays usable during a Gemini outage without
-- silently pretending the result is AI-reasoned.
-- ============================================================

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_engine_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_engine_check
  CHECK (engine IN ('gemini', 'degraded'));
