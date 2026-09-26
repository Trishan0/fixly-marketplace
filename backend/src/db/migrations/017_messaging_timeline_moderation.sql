-- ============================================================
-- Migration 017: Job messaging, job timeline, and moderation outcomes
--
-- * job_messages - one conversation per (job, worker): the customer who
--   owns the job and a worker who applied, was invited, or was hired.
-- * job_status_events - an append-only history of job status changes,
--   written by trigger so every code path is covered. Powers the job
--   timeline shown to customers and workers.
-- * payments.dispute_resolution_* - how an admin closed a disputed payment.
-- * jobs.flag_reason / flagged_at - why an admin took a job down, so the
--   customer can be told.
-- ============================================================

CREATE TABLE IF NOT EXISTS job_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_job_messages_thread_created
  ON job_messages (job_id, worker_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_messages_worker_created
  ON job_messages (worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS job_status_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_status_events_job_created
  ON job_status_events (job_id, created_at);

CREATE OR REPLACE FUNCTION fixly_record_job_status_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO job_status_events (job_id, status) VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_record_status_event ON jobs;
CREATE TRIGGER jobs_record_status_event
  AFTER INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION fixly_record_job_status_event();

-- Existing jobs: record when they were posted and, if they have moved on,
-- their current status as of their last update.
INSERT INTO job_status_events (job_id, status, created_at)
SELECT j.id, 'posted', j.created_at
FROM jobs j
WHERE NOT EXISTS (SELECT 1 FROM job_status_events e WHERE e.job_id = j.id);

INSERT INTO job_status_events (job_id, status, created_at)
SELECT j.id, j.status, COALESCE(j.updated_at, j.created_at)
FROM jobs j
WHERE j.status <> 'posted'
  AND NOT EXISTS (SELECT 1 FROM job_status_events e WHERE e.job_id = j.id AND e.status = j.status);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS dispute_resolution_note TEXT;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
