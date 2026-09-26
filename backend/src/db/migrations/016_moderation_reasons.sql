-- ============================================================
-- Migration 016: Moderation reasons and terms consent
-- Keeps the "why" next to two user-facing decisions so it can be shown
-- back to the affected person, and records when a user accepted the
-- Terms of Service and Privacy Policy at sign-up:
--   * users.nic_rejection_reason - set when an admin rejects an NIC
--     upload, cleared when the worker uploads a new image.
--   * payments.dispute_reason - the worker's reason for disputing a
--     recorded payment, shown to the customer and to admins.
--   * users.terms_accepted_at - NULL for accounts created before consent
--     was captured.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nic_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
