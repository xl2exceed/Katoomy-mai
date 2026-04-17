-- Ensure bookings.payment_status is a plain text column that accepts all values.
-- It may have been added via Supabase UI with a CHECK constraint that excludes
-- values like 'custom_paid', causing silent update failures in the custom-payment flow.

-- Drop any CHECK constraint on bookings.payment_status
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%payment_status%'
  LOOP
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END;
$$;

-- If payment_status is stored as a custom ENUM, add any missing values
DO $$
BEGIN
  -- Try to add 'custom_paid' to the enum if one exists
  ALTER TYPE public.booking_payment_status ADD VALUE IF NOT EXISTS 'custom_paid';
EXCEPTION
  WHEN undefined_object THEN NULL;  -- no such enum, column is plain text — fine
  WHEN duplicate_object THEN NULL;  -- value already exists — fine
END;
$$;

DO $$
BEGIN
  ALTER TYPE public.booking_payment_status ADD VALUE IF NOT EXISTS 'deposit_paid';
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE public.booking_payment_status ADD VALUE IF NOT EXISTS 'cash_paid';
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END;
$$;
