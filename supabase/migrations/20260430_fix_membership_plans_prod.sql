-- Fix membership_plans for new production database
-- 1. Drop the one-plan-per-business unique constraint (migration 20260409 was never applied)
-- 2. Add missing RLS policies so the client can read plans
-- 3. Ensure is_active column exists
-- All ops are idempotent.

-- 1. Drop unique constraint that limits one plan per business
ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_business_id_key,
  DROP CONSTRAINT IF EXISTS membership_plans_business_id_unique;

-- 2. Ensure is_active column exists (may be missing in freshly-created tables)
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 3. Enable RLS and add policies
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

-- Business owner can read their own plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'membership_plans'
      AND policyname = 'Business owner can view their membership plans'
  ) THEN
    CREATE POLICY "Business owner can view their membership plans"
      ON public.membership_plans FOR SELECT
      USING (business_id IN (
        SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id
      ));
  END IF;
END $$;

-- Business owner can update their own plans (for toggle active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'membership_plans'
      AND policyname = 'Business owner can update their membership plans'
  ) THEN
    CREATE POLICY "Business owner can update their membership plans"
      ON public.membership_plans FOR UPDATE
      USING (business_id IN (
        SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id
      ));
  END IF;
END $$;

-- Service role bypasses RLS (already true for service_role, but explicit grant ensures it)
GRANT ALL ON TABLE public.membership_plans TO service_role;
GRANT SELECT, UPDATE ON TABLE public.membership_plans TO authenticated;

-- 4. Same fixes for member_subscriptions
ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'member_subscriptions'
      AND policyname = 'Business owner can view their member subscriptions'
  ) THEN
    CREATE POLICY "Business owner can view their member subscriptions"
      ON public.member_subscriptions FOR SELECT
      USING (business_id IN (
        SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id
      ));
  END IF;
END $$;

GRANT ALL ON TABLE public.member_subscriptions TO service_role;
GRANT SELECT ON TABLE public.member_subscriptions TO authenticated;
