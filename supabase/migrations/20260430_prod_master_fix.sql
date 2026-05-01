-- ================================================================
-- PRODUCTION DATABASE MASTER FIX SCRIPT
-- Generated 2026-04-30 from original database schema audit
-- Run this in the NEW production Supabase SQL editor
-- Safe: functions use CREATE OR REPLACE, policies use IF NOT EXISTS
-- ================================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. HELPER FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_business_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
  UNION
  SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. CONSTRAINT FIXES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- cashapp_settings: add missing UNIQUE on business_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cashapp_settings'::regclass AND contype = 'u'
      AND conname = 'cashapp_settings_business_id_key'
  ) THEN
    ALTER TABLE public.cashapp_settings ADD CONSTRAINT cashapp_settings_business_id_key UNIQUE (business_id);
  END IF;
END $$;

-- membership_plans: drop single-plan-per-business constraint (multiple plans allowed)
ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_business_id_key,
  DROP CONSTRAINT IF EXISTS membership_plans_business_id_unique;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. ENABLE RLS ON ALL TABLES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE public.ai_help_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alternative_payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_campaign_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carwash_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_quick_book_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_platform_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_blocked_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. RLS POLICIES (add if missing)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ai_help_cache
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_help_cache' AND policyname='Allow authenticated users to insert ai_help_cache') THEN
  CREATE POLICY "Allow authenticated users to insert ai_help_cache" ON public.ai_help_cache AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_help_cache' AND policyname='Allow authenticated users to read ai_help_cache') THEN
  CREATE POLICY "Allow authenticated users to read ai_help_cache" ON public.ai_help_cache AS PERMISSIVE FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_help_cache' AND policyname='Allow authenticated users to update ai_help_cache') THEN
  CREATE POLICY "Allow authenticated users to update ai_help_cache" ON public.ai_help_cache AS PERMISSIVE FOR UPDATE TO authenticated USING (true); END IF; END $$;

-- ai_insights
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Business owner can view their ai_insights') THEN
  CREATE POLICY "Business owner can view their ai_insights" ON public.ai_insights AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='ai_insights_all') THEN
  CREATE POLICY "ai_insights_all" ON public.ai_insights AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- ai_marketing_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_marketing_settings' AND policyname='Business owner can manage their ai_marketing_settings') THEN
  CREATE POLICY "Business owner can manage their ai_marketing_settings" ON public.ai_marketing_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_marketing_settings' AND policyname='ai_marketing_settings_all') THEN
  CREATE POLICY "ai_marketing_settings_all" ON public.ai_marketing_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- alternative_payment_ledger
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alternative_payment_ledger' AND policyname='Business owner can view their ledger') THEN
  CREATE POLICY "Business owner can view their ledger" ON public.alternative_payment_ledger AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alternative_payment_ledger' AND policyname='alternative_payment_ledger_all') THEN
  CREATE POLICY "alternative_payment_ledger_all" ON public.alternative_payment_ledger AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- auto_campaign_log
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auto_campaign_log' AND policyname='Business owner can view their auto_campaign_log') THEN
  CREATE POLICY "Business owner can view their auto_campaign_log" ON public.auto_campaign_log AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;

-- availability_rules
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_rules' AND policyname='Customers can view availability') THEN
  CREATE POLICY "Customers can view availability" ON public.availability_rules AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_rules' AND policyname='Owners can manage their availability') THEN
  CREATE POLICY "Owners can manage their availability" ON public.availability_rules AS PERMISSIVE FOR ALL TO public
    USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_rules' AND policyname='availability_rules_all') THEN
  CREATE POLICY "availability_rules_all" ON public.availability_rules AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_rules' AND policyname='availability_rules_public_read') THEN
  CREATE POLICY "availability_rules_public_read" ON public.availability_rules AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- booking_payment_reports
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_payment_reports' AND policyname='Customers can view their payment report') THEN
  CREATE POLICY "Customers can view their payment report" ON public.booking_payment_reports AS PERMISSIVE FOR SELECT TO public
    USING (customer_id IN (SELECT id FROM public.customers WHERE phone = (SELECT phone FROM public.customers c2 WHERE c2.id = booking_payment_reports.customer_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_payment_reports' AND policyname='Owners can view their business payment reports') THEN
  CREATE POLICY "Owners can view their business payment reports" ON public.booking_payment_reports AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_payment_reports' AND policyname='Staff can view their business payment reports') THEN
  CREATE POLICY "Staff can view their business payment reports" ON public.booking_payment_reports AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT business_id FROM public.staff WHERE user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_payment_reports' AND policyname='booking_payment_reports_all') THEN
  CREATE POLICY "booking_payment_reports_all" ON public.booking_payment_reports AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- bookings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Anyone can create booking') THEN
  CREATE POLICY "Anyone can create booking" ON public.bookings AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Customers can create bookings') THEN
  CREATE POLICY "Customers can create bookings" ON public.bookings AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Customers can update their own bookings') THEN
  CREATE POLICY "Customers can update their own bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO public
    USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Owners can read all bookings data') THEN
  CREATE POLICY "Owners can read all bookings data" ON public.bookings AS PERMISSIVE FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.businesses WHERE id = bookings.business_id AND owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Owners can update their bookings') THEN
  CREATE POLICY "Owners can update their bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO public
    USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Owners read bookings') THEN
  CREATE POLICY "Owners read bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.businesses WHERE id = bookings.business_id AND owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='Public can check availability') THEN
  CREATE POLICY "Public can check availability" ON public.bookings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_all') THEN
  CREATE POLICY "bookings_all" ON public.bookings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_public_insert') THEN
  CREATE POLICY "bookings_public_insert" ON public.bookings AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_public_read') THEN
  CREATE POLICY "bookings_public_read" ON public.bookings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- business_features
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_features' AND policyname='Customers can view business features') THEN
  CREATE POLICY "Customers can view business features" ON public.business_features AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_features' AND policyname='Owners can manage their business features') THEN
  CREATE POLICY "Owners can manage their business features" ON public.business_features AS PERMISSIVE FOR ALL TO public
    USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_features' AND policyname='business_features_all') THEN
  CREATE POLICY "business_features_all" ON public.business_features AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_features' AND policyname='business_features_public_read') THEN
  CREATE POLICY "business_features_public_read" ON public.business_features AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- businesses
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='Authenticated users can create businesses') THEN
  CREATE POLICY "Authenticated users can create businesses" ON public.businesses AS PERMISSIVE FOR INSERT TO public WITH CHECK (owner_user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='Customers can view business by slug') THEN
  CREATE POLICY "Customers can view business by slug" ON public.businesses AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='Owners can update their own business') THEN
  CREATE POLICY "Owners can update their own business" ON public.businesses AS PERMISSIVE FOR UPDATE TO public USING (owner_user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='Owners can view their own business') THEN
  CREATE POLICY "Owners can view their own business" ON public.businesses AS PERMISSIVE FOR SELECT TO public USING (owner_user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='businesses_all_owner') THEN
  CREATE POLICY "businesses_all_owner" ON public.businesses AS PERMISSIVE FOR ALL TO public
    USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='businesses_public_read') THEN
  CREATE POLICY "businesses_public_read" ON public.businesses AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- cancellation_policies
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cancellation_policies' AND policyname='Customers can view cancellation policy') THEN
  CREATE POLICY "Customers can view cancellation policy" ON public.cancellation_policies AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cancellation_policies' AND policyname='Owners can manage their cancellation policy') THEN
  CREATE POLICY "Owners can manage their cancellation policy" ON public.cancellation_policies AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cancellation_policies' AND policyname='cancellation_policies_all') THEN
  CREATE POLICY "cancellation_policies_all" ON public.cancellation_policies AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cancellation_policies' AND policyname='cancellation_policies_public_read') THEN
  CREATE POLICY "cancellation_policies_public_read" ON public.cancellation_policies AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- carwash_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carwash_settings' AND policyname='carwash_settings_owner_all') THEN
  CREATE POLICY "carwash_settings_owner_all" ON public.carwash_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carwash_settings' AND policyname='carwash_settings_public_read') THEN
  CREATE POLICY "carwash_settings_public_read" ON public.carwash_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carwash_settings' AND policyname='carwash_settings_staff_read') THEN
  CREATE POLICY "carwash_settings_staff_read" ON public.carwash_settings AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true)); END IF; END $$;

-- cashapp_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashapp_settings' AND policyname='Business owner can manage their cashapp_settings') THEN
  CREATE POLICY "Business owner can manage their cashapp_settings" ON public.cashapp_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashapp_settings' AND policyname='cashapp_settings_all') THEN
  CREATE POLICY "cashapp_settings_all" ON public.cashapp_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cashapp_settings' AND policyname='cashapp_settings_public_read') THEN
  CREATE POLICY "cashapp_settings_public_read" ON public.cashapp_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- customer_quick_book_defaults
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_quick_book_defaults' AND policyname='service_role_full_access') THEN
  CREATE POLICY "service_role_full_access" ON public.customer_quick_book_defaults AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;

-- customers
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anyone can create customer') THEN
  CREATE POLICY "Anyone can create customer" ON public.customers AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anyone can create customer profiles') THEN
  CREATE POLICY "Anyone can create customer profiles" ON public.customers AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anyone can read customers for booking') THEN
  CREATE POLICY "Anyone can read customers for booking" ON public.customers AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anyone can update customer by phone') THEN
  CREATE POLICY "Anyone can update customer by phone" ON public.customers AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Customers can update their own profile') THEN
  CREATE POLICY "Customers can update their own profile" ON public.customers AS PERMISSIVE FOR UPDATE TO public USING (user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Customers can view their own profile') THEN
  CREATE POLICY "Customers can view their own profile" ON public.customers AS PERMISSIVE FOR SELECT TO public USING (user_id = auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Owners can read customers for their business') THEN
  CREATE POLICY "Owners can read customers for their business" ON public.customers AS PERMISSIVE FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Owners can update their customers') THEN
  CREATE POLICY "Owners can update their customers" ON public.customers AS PERMISSIVE FOR UPDATE TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Owners can view their customers') THEN
  CREATE POLICY "Owners can view their customers" ON public.customers AS PERMISSIVE FOR SELECT TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Public can lookup by referral code') THEN
  CREATE POLICY "Public can lookup by referral code" ON public.customers AS PERMISSIVE FOR SELECT TO public USING (referral_code IS NOT NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers_all') THEN
  CREATE POLICY "customers_all" ON public.customers AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers_public_insert') THEN
  CREATE POLICY "customers_public_insert" ON public.customers AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers_public_read') THEN
  CREATE POLICY "customers_public_read" ON public.customers AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers_public_update') THEN
  CREATE POLICY "customers_public_update" ON public.customers AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true); END IF; END $$;

-- deposit_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposit_settings' AND policyname='Customers can view deposit settings') THEN
  CREATE POLICY "Customers can view deposit settings" ON public.deposit_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposit_settings' AND policyname='Owners can manage their deposit settings') THEN
  CREATE POLICY "Owners can manage their deposit settings" ON public.deposit_settings AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposit_settings' AND policyname='deposit_settings_all') THEN
  CREATE POLICY "deposit_settings_all" ON public.deposit_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposit_settings' AND policyname='deposit_settings_public_read') THEN
  CREATE POLICY "deposit_settings_public_read" ON public.deposit_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- feedback
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='Customers can create feedback') THEN
  CREATE POLICY "Customers can create feedback" ON public.feedback AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
      AND (booking_id IS NULL OR booking_id IN (SELECT id FROM public.bookings WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='Customers can view their own feedback') THEN
  CREATE POLICY "Customers can view their own feedback" ON public.feedback AS PERMISSIVE FOR SELECT TO public
    USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='Owners can view feedback for their business') THEN
  CREATE POLICY "Owners can view feedback for their business" ON public.feedback AS PERMISSIVE FOR SELECT TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='feedback_all') THEN
  CREATE POLICY "feedback_all" ON public.feedback AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedback' AND policyname='feedback_public_insert') THEN
  CREATE POLICY "feedback_public_insert" ON public.feedback AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;

-- loyalty_ledger
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Allow checking existing points') THEN
  CREATE POLICY "Allow checking existing points" ON public.loyalty_ledger AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Customers can view their own loyalty points') THEN
  CREATE POLICY "Customers can view their own loyalty points" ON public.loyalty_ledger AS PERMISSIVE FOR SELECT TO public
    USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Owners can insert loyalty points') THEN
  CREATE POLICY "Owners can insert loyalty points" ON public.loyalty_ledger AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Owners can read all loyalty data') THEN
  CREATE POLICY "Owners can read all loyalty data" ON public.loyalty_ledger AS PERMISSIVE FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.businesses WHERE id = loyalty_ledger.business_id AND owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Owners can view their loyalty ledger') THEN
  CREATE POLICY "Owners can view their loyalty ledger" ON public.loyalty_ledger AS PERMISSIVE FOR SELECT TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='Service role can manage loyalty ledger') THEN
  CREATE POLICY "Service role can manage loyalty ledger" ON public.loyalty_ledger AS PERMISSIVE FOR ALL TO public USING (auth.uid() IS NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='loyalty_ledger_all') THEN
  CREATE POLICY "loyalty_ledger_all" ON public.loyalty_ledger AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_ledger' AND policyname='loyalty_ledger_public_read') THEN
  CREATE POLICY "loyalty_ledger_public_read" ON public.loyalty_ledger AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- loyalty_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_settings' AND policyname='Anyone can read loyalty settings') THEN
  CREATE POLICY "Anyone can read loyalty settings" ON public.loyalty_settings AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_settings' AND policyname='Customers can view loyalty settings') THEN
  CREATE POLICY "Customers can view loyalty settings" ON public.loyalty_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_settings' AND policyname='Owners can manage their loyalty settings') THEN
  CREATE POLICY "Owners can manage their loyalty settings" ON public.loyalty_settings AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_settings' AND policyname='loyalty_settings_all') THEN
  CREATE POLICY "loyalty_settings_all" ON public.loyalty_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='loyalty_settings' AND policyname='loyalty_settings_public_read') THEN
  CREATE POLICY "loyalty_settings_public_read" ON public.loyalty_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- member_subscriptions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_subscriptions' AND policyname='member_subscriptions_all') THEN
  CREATE POLICY "member_subscriptions_all" ON public.member_subscriptions AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_subscriptions' AND policyname='member_subscriptions_public_read') THEN
  CREATE POLICY "member_subscriptions_public_read" ON public.member_subscriptions AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- membership_plans
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membership_plans' AND policyname='membership_plans_all') THEN
  CREATE POLICY "membership_plans_all" ON public.membership_plans AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membership_plans' AND policyname='membership_plans_public_read') THEN
  CREATE POLICY "membership_plans_public_read" ON public.membership_plans AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- monthly_platform_billing
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_platform_billing' AND policyname='Business owner can view their monthly billing') THEN
  CREATE POLICY "Business owner can view their monthly billing" ON public.monthly_platform_billing AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_platform_billing' AND policyname='monthly_platform_billing_deny_all') THEN
  CREATE POLICY "monthly_platform_billing_deny_all" ON public.monthly_platform_billing AS PERMISSIVE FOR ALL TO public USING (false); END IF; END $$;

-- notification_log
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_log' AND policyname='notification_log_all') THEN
  CREATE POLICY "notification_log_all" ON public.notification_log AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_log' AND policyname='notification_log_public_insert') THEN
  CREATE POLICY "notification_log_public_insert" ON public.notification_log AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;

-- notification_rules
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_rules' AND policyname='notification_rules_all') THEN
  CREATE POLICY "notification_rules_all" ON public.notification_rules AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- notification_settings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_settings' AND policyname='Customers can view notification settings') THEN
  CREATE POLICY "Customers can view notification settings" ON public.notification_settings AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_settings' AND policyname='Owners can manage their notification settings') THEN
  CREATE POLICY "Owners can manage their notification settings" ON public.notification_settings AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_settings' AND policyname='notification_settings_all') THEN
  CREATE POLICY "notification_settings_all" ON public.notification_settings AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- onboarding_state
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_state' AND policyname='Owners can manage their onboarding state') THEN
  CREATE POLICY "Owners can manage their onboarding state" ON public.onboarding_state AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_state' AND policyname='onboarding_state_all') THEN
  CREATE POLICY "onboarding_state_all" ON public.onboarding_state AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- payments
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Customers can view their own payments') THEN
  CREATE POLICY "Customers can view their own payments" ON public.payments AS PERMISSIVE FOR SELECT TO public
    USING (booking_id IN (SELECT id FROM public.bookings WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Owners can view their payments') THEN
  CREATE POLICY "Owners can view their payments" ON public.payments AS PERMISSIVE FOR SELECT TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Service role can manage payments') THEN
  CREATE POLICY "Service role can manage payments" ON public.payments AS PERMISSIVE FOR ALL TO public USING (auth.uid() IS NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='payments_all') THEN
  CREATE POLICY "payments_all" ON public.payments AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- phone_health
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='phone_health' AND policyname='phone_health_deny_all') THEN
  CREATE POLICY "phone_health_deny_all" ON public.phone_health AS PERMISSIVE FOR ALL TO public USING (false); END IF; END $$;

-- push_subscriptions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='push_subscriptions_all') THEN
  CREATE POLICY "push_subscriptions_all" ON public.push_subscriptions AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='push_subscriptions_public_upsert') THEN
  CREATE POLICY "push_subscriptions_public_upsert" ON public.push_subscriptions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true); END IF; END $$;

-- referral_reminder_log
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_reminder_log' AND policyname='Business owner can view their referral_reminder_log') THEN
  CREATE POLICY "Business owner can view their referral_reminder_log" ON public.referral_reminder_log AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_reminder_log' AND policyname='referral_reminder_log_all') THEN
  CREATE POLICY "referral_reminder_log_all" ON public.referral_reminder_log AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- referrals
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='Allow public to create referrals') THEN
  CREATE POLICY "Allow public to create referrals" ON public.referrals AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='Owners can update their referrals') THEN
  CREATE POLICY "Owners can update their referrals" ON public.referrals AS PERMISSIVE FOR UPDATE TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='Owners can view their referrals') THEN
  CREATE POLICY "Owners can view their referrals" ON public.referrals AS PERMISSIVE FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='referrals_all') THEN
  CREATE POLICY "referrals_all" ON public.referrals AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='referrals_public_read') THEN
  CREATE POLICY "referrals_public_read" ON public.referrals AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- refunds
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refunds' AND policyname='Owners can manage their refunds') THEN
  CREATE POLICY "Owners can manage their refunds" ON public.refunds AS PERMISSIVE FOR ALL TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='refunds' AND policyname='refunds_all') THEN
  CREATE POLICY "refunds_all" ON public.refunds AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- scheduled_messages
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_messages' AND policyname='scheduled_messages_all') THEN
  CREATE POLICY "scheduled_messages_all" ON public.scheduled_messages AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- scheduled_notifications
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_notifications' AND policyname='scheduled_notifications_all') THEN
  CREATE POLICY "scheduled_notifications_all" ON public.scheduled_notifications AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- service_addons
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_addons' AND policyname='service_addons_owner_all') THEN
  CREATE POLICY "service_addons_owner_all" ON public.service_addons AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_addons' AND policyname='service_addons_public_read') THEN
  CREATE POLICY "service_addons_public_read" ON public.service_addons AS PERMISSIVE FOR SELECT TO public USING (active = true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_addons' AND policyname='service_addons_staff_read') THEN
  CREATE POLICY "service_addons_staff_read" ON public.service_addons AS PERMISSIVE FOR SELECT TO public
    USING (business_id IN (SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true)); END IF; END $$;

-- services
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='Customers can view active services') THEN
  CREATE POLICY "Customers can view active services" ON public.services AS PERMISSIVE FOR SELECT TO public USING (active = true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='Owners can manage their services') THEN
  CREATE POLICY "Owners can manage their services" ON public.services AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='Owners can read their services') THEN
  CREATE POLICY "Owners can read their services" ON public.services AS PERMISSIVE FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_all') THEN
  CREATE POLICY "services_all" ON public.services AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_public_read') THEN
  CREATE POLICY "services_public_read" ON public.services AS PERMISSIVE FOR SELECT TO public USING (true); END IF; END $$;

-- sms_campaign_recipients
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_campaign_recipients' AND policyname='sms_campaign_recipients_all') THEN
  CREATE POLICY "sms_campaign_recipients_all" ON public.sms_campaign_recipients AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- sms_campaigns
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_campaigns' AND policyname='sms_campaigns_all') THEN
  CREATE POLICY "sms_campaigns_all" ON public.sms_campaigns AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- sms_messages
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_messages' AND policyname='sms_messages_all') THEN
  CREATE POLICY "sms_messages_all" ON public.sms_messages AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- sms_templates
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_templates' AND policyname='Owner can manage sms_templates') THEN
  CREATE POLICY "Owner can manage sms_templates" ON public.sms_templates AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sms_templates' AND policyname='sms_templates_all') THEN
  CREATE POLICY "sms_templates_all" ON public.sms_templates AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- social_posts
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='social_posts' AND policyname='Business owner can manage their social_posts') THEN
  CREATE POLICY "Business owner can manage their social_posts" ON public.social_posts AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT id FROM public.businesses WHERE auth.uid() = owner_user_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='social_posts' AND policyname='social_posts_all') THEN
  CREATE POLICY "social_posts_all" ON public.social_posts AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- staff
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='Premium owners can delete their staff') THEN
  CREATE POLICY "Premium owners can delete their staff" ON public.staff AS PERMISSIVE FOR DELETE TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses b WHERE b.owner_user_id = auth.uid()
      AND (b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='Premium owners can insert staff') THEN
  CREATE POLICY "Premium owners can insert staff" ON public.staff AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (business_id IN (SELECT id FROM public.businesses b WHERE b.owner_user_id = auth.uid()
      AND (b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='Premium owners can update their staff') THEN
  CREATE POLICY "Premium owners can update their staff" ON public.staff AS PERMISSIVE FOR UPDATE TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses b WHERE b.owner_user_id = auth.uid()
      AND (b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true')))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses b WHERE b.owner_user_id = auth.uid()
      AND (b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='Premium owners can view their staff') THEN
  CREATE POLICY "Premium owners can view their staff" ON public.staff AS PERMISSIVE FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM public.businesses b WHERE b.owner_user_id = auth.uid()
      AND (b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='Public can view active staff for premium businesses') THEN
  CREATE POLICY "Public can view active staff for premium businesses" ON public.staff AS PERMISSIVE FOR SELECT TO anon, authenticated
    USING (is_active = true AND business_id IN (SELECT id FROM public.businesses b
      WHERE b.subscription_plan = ANY (ARRAY['premium','pro']) OR (b.features->>'staff_management') = 'true')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_all') THEN
  CREATE POLICY "staff_all" ON public.staff AS PERMISSIVE FOR ALL TO public
    USING ((business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())) OR (user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_public_read') THEN
  CREATE POLICY "staff_public_read" ON public.staff AS PERMISSIVE FOR SELECT TO public
    USING (visible_for_booking = true AND is_active = true); END IF; END $$;

-- staff_blocked_time
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_blocked_time' AND policyname='service_role_full_access') THEN
  CREATE POLICY "service_role_full_access" ON public.staff_blocked_time AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_blocked_time' AND policyname='staff_blocked_time_all') THEN
  CREATE POLICY "staff_blocked_time_all" ON public.staff_blocked_time AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- staff_qr_tokens
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_qr_tokens' AND policyname='staff_qr_tokens_deny_all') THEN
  CREATE POLICY "staff_qr_tokens_deny_all" ON public.staff_qr_tokens AS PERMISSIVE FOR ALL TO public USING (false); END IF; END $$;

-- stripe_connect_accounts
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_connect_accounts' AND policyname='Owners can view their Stripe account') THEN
  CREATE POLICY "Owners can view their Stripe account" ON public.stripe_connect_accounts AS PERMISSIVE FOR SELECT TO public USING (is_business_owner(business_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_connect_accounts' AND policyname='Service role can manage Stripe accounts') THEN
  CREATE POLICY "Service role can manage Stripe accounts" ON public.stripe_connect_accounts AS PERMISSIVE FOR ALL TO public USING (auth.uid() IS NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_connect_accounts' AND policyname='stripe_connect_accounts_all') THEN
  CREATE POLICY "stripe_connect_accounts_all" ON public.stripe_connect_accounts AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;

-- tips
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tips' AND policyname='service_role_full_access') THEN
  CREATE POLICY "service_role_full_access" ON public.tips AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tips' AND policyname='tips_all') THEN
  CREATE POLICY "tips_all" ON public.tips AS PERMISSIVE FOR ALL TO public
    USING (business_id IN (SELECT get_my_business_ids()))
    WITH CHECK (business_id IN (SELECT get_my_business_ids())); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tips' AND policyname='tips_public_insert') THEN
  CREATE POLICY "tips_public_insert" ON public.tips AS PERMISSIVE FOR INSERT TO public WITH CHECK (true); END IF; END $$;
