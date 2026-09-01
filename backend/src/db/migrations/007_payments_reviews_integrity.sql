-- Phase 4: explicit payment state and review integrity.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE worker_confirmed = true AND disputed = true) THEN
    RAISE EXCEPTION 'Cannot migrate payments with both worker_confirmed and disputed set';
  END IF;
END $$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'recorded';

UPDATE payments
SET status = CASE
  WHEN worker_confirmed THEN 'confirmed'
  WHEN disputed THEN 'disputed'
  ELSE 'recorded'
END
WHERE status = 'recorded';

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('recorded', 'confirmed', 'disputed')) NOT VALID,
  ADD CONSTRAINT payments_amount_positive
  CHECK (amount > 0) NOT VALID;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_job_required CHECK (job_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT reviews_customer_required CHECK (customer_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT reviews_worker_required CHECK (worker_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT reviews_rating_required CHECK (rating IS NOT NULL) NOT VALID;

ALTER TABLE payments VALIDATE CONSTRAINT payments_status_check;
ALTER TABLE payments VALIDATE CONSTRAINT payments_amount_positive;
ALTER TABLE reviews VALIDATE CONSTRAINT reviews_job_required;
ALTER TABLE reviews VALIDATE CONSTRAINT reviews_customer_required;
ALTER TABLE reviews VALIDATE CONSTRAINT reviews_worker_required;
ALTER TABLE reviews VALIDATE CONSTRAINT reviews_rating_required;

CREATE OR REPLACE FUNCTION fixly_enforce_payment_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'recorded' THEN
    RAISE EXCEPTION 'Payments must be created in recorded state' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'Payment amount is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> OLD.status
       AND NOT (OLD.status = 'recorded' AND NEW.status IN ('confirmed', 'disputed')) THEN
      RAISE EXCEPTION 'Invalid payment state transition from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.worker_confirmed := NEW.status = 'confirmed';
  NEW.disputed := NEW.status = 'disputed';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_enforce_state ON payments;
CREATE TRIGGER payments_enforce_state
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION fixly_enforce_payment_state();
