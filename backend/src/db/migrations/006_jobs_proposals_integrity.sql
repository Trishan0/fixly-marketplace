-- Phase 3: marketplace workflow invariants.
-- These constraints are additive and forward-only. Existing data is audited by
-- db:audit:marketplace before this migration is promoted to a shared database.

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_one_accepted_per_job
  ON proposals(job_id)
  WHERE status = 'accepted';

ALTER TABLE jobs
  ADD CONSTRAINT jobs_customer_required
  CHECK (customer_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT jobs_category_required
  CHECK (category_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT jobs_assigned_status_requires_worker
  CHECK (
    status NOT IN ('assigned', 'in_progress', 'completed', 'payment_recorded', 'reviewed')
    OR assigned_worker_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE proposals
  ADD CONSTRAINT proposals_job_required
  CHECK (job_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT proposals_worker_required
  CHECK (worker_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT proposals_price_positive
  CHECK (proposed_price IS NULL OR proposed_price > 0) NOT VALID;

ALTER TABLE jobs VALIDATE CONSTRAINT jobs_customer_required;
ALTER TABLE jobs VALIDATE CONSTRAINT jobs_category_required;
ALTER TABLE jobs VALIDATE CONSTRAINT jobs_assigned_status_requires_worker;
ALTER TABLE proposals VALIDATE CONSTRAINT proposals_job_required;
ALTER TABLE proposals VALIDATE CONSTRAINT proposals_worker_required;
ALTER TABLE proposals VALIDATE CONSTRAINT proposals_price_positive;
