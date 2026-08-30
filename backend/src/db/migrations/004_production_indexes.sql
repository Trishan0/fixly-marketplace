-- Prevent duplicate skill/category rows created by legacy demo seed runs.
DELETE FROM worker_skills duplicate
USING worker_skills original
WHERE duplicate.worker_id = original.worker_id
  AND duplicate.category_id = original.category_id
  AND duplicate.id > original.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_skills_worker_category
  ON worker_skills(worker_id, category_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name_ci
  ON categories(LOWER(name));

CREATE INDEX IF NOT EXISTS idx_jobs_customer_created
  ON jobs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_active_created
  ON jobs(status, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_category_district
  ON jobs(category_id, district);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_worker_status
  ON jobs(assigned_worker_id, status);

CREATE INDEX IF NOT EXISTS idx_proposals_job_status
  ON proposals(job_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_worker_created
  ON proposals(worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invites_worker_status_created
  ON invites(worker_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_customer_created
  ON invites(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_worker_created
  ON reviews(worker_id, created_at DESC);
