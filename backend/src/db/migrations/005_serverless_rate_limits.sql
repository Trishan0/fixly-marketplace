CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key_hash VARCHAR(64) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires_at
  ON rate_limit_buckets(expires_at);
