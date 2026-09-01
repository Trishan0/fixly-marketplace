-- Phase 6: identity and profile integrity. These changes are additive and
-- preserve the existing migration ledger as the schema authority.

-- Runtime code stores only SHA-256 token hashes. Remove values from the
-- superseded raw-token column before preventing any future raw-token writes.
UPDATE users
SET email_verify_token = NULL
WHERE email_verify_token IS NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_no_raw_email_verify_token
  CHECK (email_verify_token IS NULL) NOT VALID,
  ADD CONSTRAINT users_dashboard_mode_valid
  CHECK (dashboard_mode IN ('standard', 'simplified')) NOT VALID;

ALTER TABLE users VALIDATE CONSTRAINT users_no_raw_email_verify_token;
ALTER TABLE users VALIDATE CONSTRAINT users_dashboard_mode_valid;

-- Application-level lowercasing is not a substitute for a database identity
-- invariant. Existing duplicate case variants must be reconciled before this
-- migration is promoted if the preflight query below returns rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci
  ON users (LOWER(email));

ALTER TABLE worker_profiles
  ADD CONSTRAINT worker_profiles_user_required
  CHECK (user_id IS NOT NULL) NOT VALID;
ALTER TABLE worker_profiles VALIDATE CONSTRAINT worker_profiles_user_required;

ALTER TABLE worker_skills
  ADD CONSTRAINT worker_skills_worker_required
  CHECK (worker_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT worker_skills_category_required
  CHECK (category_id IS NOT NULL) NOT VALID;
ALTER TABLE worker_skills VALIDATE CONSTRAINT worker_skills_worker_required;
ALTER TABLE worker_skills VALIDATE CONSTRAINT worker_skills_category_required;
