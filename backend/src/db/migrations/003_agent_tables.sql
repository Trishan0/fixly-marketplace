-- ============================================================
-- Migration 003: Agent Tables
-- AI Agent storage for match agent and proposal agent workflows
-- ============================================================

-- agent_runs: one row per agent invocation
CREATE TABLE IF NOT EXISTS agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type    VARCHAR(30) NOT NULL CHECK (agent_type IN ('match', 'proposal')),
  objective     TEXT,
  plan_json     JSONB,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'error')),
  -- context references (one of these will be set depending on agent_type)
  job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id   ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_job_id    ON agent_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status    ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created   ON agent_runs(created_at DESC);

-- agent_run_steps: step-by-step trace of what the agent did
CREATE TABLE IF NOT EXISTS agent_run_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index  INT NOT NULL DEFAULT 0,
  step_name   VARCHAR(100) NOT NULL,
  input_json  JSONB,
  output_json JSONB,
  decision    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_id ON agent_run_steps(run_id);

-- agent_memories: per-user persistent preferences / context
-- UNIQUE(user_id, scope, key) enables safe upsert with ON CONFLICT
CREATE TABLE IF NOT EXISTS agent_memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope       VARCHAR(50) NOT NULL,   -- e.g. 'match_prefs', 'proposal_prefs'
  key         VARCHAR(100) NOT NULL,  -- e.g. 'preferred_district', 'budget_band'
  value_json  JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_user_scope ON agent_memories(user_id, scope);

-- agent_recommendations: ranked outputs from agent runs
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  entity_type  VARCHAR(20) NOT NULL CHECK (entity_type IN ('worker', 'job')),
  entity_id    UUID NOT NULL,        -- worker user id OR job id
  score        NUMERIC(5,4) NOT NULL CHECK (score BETWEEN 0 AND 1),
  factors_json JSONB,                -- breakdown of individual factor scores
  rationale    TEXT,                 -- human-readable explanation
  rank         INT NOT NULL,
  -- action tracking
  action_taken VARCHAR(30),          -- 'invited', 'proposal_submitted', null
  action_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_recommendations_run_id ON agent_recommendations(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_recommendations_rank   ON agent_recommendations(run_id, rank);
