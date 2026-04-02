-- Add appointment_ts column to alternative_payment_ledger for exact appointment time
ALTER TABLE public.alternative_payment_ledger
  ADD COLUMN IF NOT EXISTS appointment_ts timestamptz;
