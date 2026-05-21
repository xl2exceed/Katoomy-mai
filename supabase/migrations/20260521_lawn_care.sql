-- Lawn care niche settings
CREATE TABLE IF NOT EXISTS public.lawn_care_settings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_radius_miles      INTEGER     DEFAULT 25,
  travel_fee_enabled        BOOLEAN     DEFAULT FALSE,
  travel_fee_type           TEXT        DEFAULT 'flat' CHECK (travel_fee_type IN ('flat', 'per_mile')),
  travel_fee_flat_cents     INTEGER     DEFAULT 0,
  travel_fee_per_mile_cents INTEGER     DEFAULT 0,
  -- Per-property-size surcharges in cents (added on top of base service price)
  property_surcharges       JSONB       DEFAULT '{"small":0,"medium":0,"large":0,"xl":0}'::jsonb,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id)
);

ALTER TABLE public.lawn_care_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lawn_care_settings"
  ON public.lawn_care_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
