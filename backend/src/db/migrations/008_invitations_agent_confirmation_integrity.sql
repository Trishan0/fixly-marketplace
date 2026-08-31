-- Phase 5: invitation and agent-confirmation concurrency guards.

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_runs_active_match
  ON agent_runs(user_id, job_id)
  WHERE agent_type = 'match'
    AND job_id IS NOT NULL
    AND status IN ('pending', 'running', 'awaiting_confirmation');

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_runs_active_proposal
  ON agent_runs(user_id)
  WHERE agent_type = 'proposal'
    AND status IN ('pending', 'running', 'awaiting_confirmation');

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_recommendations_run_entity
  ON agent_recommendations(run_id, entity_type, entity_id);
