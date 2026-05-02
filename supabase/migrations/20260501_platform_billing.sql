-- Platform billing: track billing interval per business and log every charge

-- Add billing columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('weekly', 'bi-weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMPTZ;

-- Ledger table: one row per billing run per business
CREATE TABLE IF NOT EXISTS public.platform_billing_ledger (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id               UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_start              TIMESTAMPTZ NOT NULL,
  period_end                TIMESTAMPTZ NOT NULL,
  billing_interval          TEXT NOT NULL,
  completed_bookings        INT NOT NULL DEFAULT 0,
  amount_cents              INT NOT NULL DEFAULT 0,
  stripe_payment_intent_id  TEXT,
  stripe_customer_id        TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('paid', 'failed', 'skipped', 'no_card', 'pending')),
  failure_message           TEXT,
  created_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_billing_business
  ON public.platform_billing_ledger (business_id, created_at DESC);

-- RLS: only service role can read/write (platform-internal only)
ALTER TABLE public.platform_billing_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_service_only"
  ON public.platform_billing_ledger
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
