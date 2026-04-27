-- Migration: 20260427_last_visit_at.sql
-- Adds last_visit_at to the customers table and keeps it in sync via a
-- Postgres trigger that fires whenever a booking's status is set to 'complete'.
-- Also backfills from existing completed bookings.

-- 1. Add the column (safe to run multiple times)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_visit_at timestamptz;

-- 2. Backfill from existing completed bookings
--    For each customer, set last_visit_at to their most recent completed booking's end_ts.
UPDATE customers c
SET last_visit_at = (
  SELECT MAX(b.end_ts)
  FROM bookings b
  WHERE b.customer_id = c.id
    AND b.status = 'completed'
)
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.customer_id = c.id
    AND b.status = 'completed'
);

-- 3. Trigger function — fires after a booking row is inserted or updated
CREATE OR REPLACE FUNCTION update_customer_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when the booking status is (or becomes) 'complete'
  IF NEW.status = 'completed' THEN
    UPDATE customers
    SET last_visit_at = GREATEST(COALESCE(last_visit_at, '1970-01-01'::timestamptz), NEW.end_ts)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to bookings table
DROP TRIGGER IF EXISTS trg_customer_last_visit_at ON bookings;
CREATE TRIGGER trg_customer_last_visit_at
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_last_visit_at();
