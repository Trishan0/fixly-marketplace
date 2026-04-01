ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verify_token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verify_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verify_token_hash
  ON users(email_verify_token_hash);

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
  ON users(password_reset_token_hash);
