-- SMS delivery tracking: phone health, delivery status callbacks
-- Run in Supabase SQL editor before deploying the corresponding code changes.

-- 1. Add delivery tracking columns to sms_messages
ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_code      integer,
  ADD COLUMN IF NOT EXISTS error_message   text,
  ADD COLUMN IF NOT EXISTS delivered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- 2. Widen the status constraint to include all Twilio delivery statuses
--    (original only had queued/sent/delivered/failed/received)
ALTER TABLE public.sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_status_check;

ALTER TABLE public.sms_messages
  ADD CONSTRAINT sms_messages_status_check
  CHECK (status = ANY (ARRAY[
    'accepted','queued','sending','sent',
    'delivered','undelivered','failed',
    'received','read','canceled'
  ]));

-- 3. Index for fast webhook lookups by Twilio SID
CREATE INDEX IF NOT EXISTS sms_messages_provider_message_id_idx
  ON public.sms_messages (provider_message_id);

-- 4. phone_health table — one row per E.164 phone number
--    Tracks delivery failures and blocks sends after repeated failures.
CREATE TABLE IF NOT EXISTS public.phone_health (
  normalized_phone  text PRIMARY KEY,
  failure_count     integer NOT NULL DEFAULT 0,
  send_blocked      boolean NOT NULL DEFAULT false,
  last_failure_at   timestamptz,
  last_delivered_at timestamptz,
  last_error_code   integer,
  last_error_message text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_health_send_blocked_idx ON public.phone_health (send_blocked);
