-- ============================================================
-- Payment Acknowledgment System
-- Adds booking_payment_reports for external payment tracking
-- Adds zelle fields to cashapp_settings
-- ============================================================

-- 1. Add Zelle fields to cashapp_settings
ALTER TABLE public.cashapp_settings
  ADD COLUMN IF NOT EXISTS zelle_phone text,
  ADD COLUMN IF NOT EXISTS zelle_email text,
  ADD COLUMN IF NOT EXISTS zelle_enabled boolean NOT NULL DEFAULT false;

-- 2. booking_payment_reports
-- One row per booking that uses an external/manual payment method.
-- Tracks customer and business responses and resolves to a fee decision.
CREATE TABLE IF NOT EXISTS public.booking_payment_reports (
  id                              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id                      uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  business_id                     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id                     uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  payment_method                  text NOT NULL, -- 'cash_app', 'zelle', 'cash'

  customer_response               text NOT NULL DEFAULT 'pending'
                                    CHECK (customer_response IN ('pending', 'paid', 'unpaid')),
  customer_response_at            timestamptz,

  business_response               text NOT NULL DEFAULT 'pending'
                                    CHECK (business_response IN ('pending', 'paid', 'unpaid')),
  business_response_at            timestamptz,
  business_responded_by           uuid REFERENCES public.staff(id) ON DELETE SET NULL,

  resolution_status               text NOT NULL DEFAULT 'pending'
                                    CHECK (resolution_status IN ('pending', 'confirmed_paid', 'disputed_unpaid', 'auto_confirmed')),
  resolution_reason               text
                                    CHECK (resolution_reason IS NULL OR resolution_reason IN (
                                      'both_paid',
                                      'business_paid_only',
                                      'customer_paid_business_timeout',
                                      'no_response_timeout',
                                      'customer_paid_business_unpaid'
                                    )),

  fee_should_charge               boolean NOT NULL DEFAULT false,
  fee_charged                     boolean NOT NULL DEFAULT false,
  fee_charged_at                  timestamptz,
  fee_amount_cents                integer NOT NULL DEFAULT 100,

  service_amount_cents            integer NOT NULL DEFAULT 0,
  tip_cents                       integer NOT NULL DEFAULT 0,
  total_amount_cents              integer NOT NULL DEFAULT 0,

  auto_resolve_at                 timestamptz NOT NULL,
  resolved_at                     timestamptz,

  -- Tracks how many times customer=paid / business=unpaid for compliance
  dispute_counted                 boolean NOT NULL DEFAULT false,

  created_at                      timestamptz DEFAULT now() NOT NULL,
  updated_at                      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bpr_business_id ON public.booking_payment_reports(business_id);
CREATE INDEX IF NOT EXISTS idx_bpr_resolution_status ON public.booking_payment_reports(resolution_status);
CREATE INDEX IF NOT EXISTS idx_bpr_auto_resolve_at ON public.booking_payment_reports(auto_resolve_at);
CREATE INDEX IF NOT EXISTS idx_bpr_fee ON public.booking_payment_reports(fee_should_charge, fee_charged);

ALTER TABLE public.booking_payment_reports ENABLE ROW LEVEL SECURITY;

-- Customers can read their own report and update customer_response (enforced in API)
CREATE POLICY "Customers can view their payment report"
  ON public.booking_payment_reports FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE phone = (
        SELECT phone FROM public.customers WHERE id = customer_id
      )
    )
  );

-- Business owners can read all reports for their business
CREATE POLICY "Owners can view their business payment reports"
  ON public.booking_payment_reports FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
  );

-- Staff members can view payment reports for their business
CREATE POLICY "Staff can view their business payment reports"
  ON public.booking_payment_reports FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.staff WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.booking_payment_reports TO service_role;
GRANT SELECT ON TABLE public.booking_payment_reports TO authenticated;

-- Enable Supabase real-time for this table
ALTER publication supabase_realtime ADD TABLE public.booking_payment_reports;

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bpr_updated_at ON public.booking_payment_reports;
CREATE TRIGGER trg_bpr_updated_at
  BEFORE UPDATE ON public.booking_payment_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
