-- Force-recreate customer-facing public read policies
-- Uses DROP + CREATE (not IF NOT EXISTS) so the content is guaranteed correct
-- regardless of what the schema backup left behind.
-- All policies are PERMISSIVE SELECT — they add access, never remove it.

-- ── bookings ──────────────────────────────────────────────────────────────────
-- Needed by: confirmation page, customer dashboard, staff schedule
DROP POLICY IF EXISTS "bookings_public_read" ON public.bookings;
CREATE POLICY "bookings_public_read"
  ON public.bookings AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can check availability" ON public.bookings;
CREATE POLICY "Public can check availability"
  ON public.bookings AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

-- ── services ──────────────────────────────────────────────────────────────────
-- Needed by: booking flow (customer-info page reads service price)
DROP POLICY IF EXISTS "services_public_read" ON public.services;
CREATE POLICY "services_public_read"
  ON public.services AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Customers can view active services" ON public.services;
CREATE POLICY "Customers can view active services"
  ON public.services AS PERMISSIVE FOR SELECT TO public USING (active = true);

-- ── customers ─────────────────────────────────────────────────────────────────
-- Needed by: customer dashboard (phone-based lookup, no auth)
DROP POLICY IF EXISTS "customers_public_read" ON public.customers;
CREATE POLICY "customers_public_read"
  ON public.customers AS PERMISSIVE FOR SELECT TO public USING (true);

-- ── businesses ────────────────────────────────────────────────────────────────
-- Needed by: all customer-facing pages (slug lookup)
DROP POLICY IF EXISTS "businesses_public_read" ON public.businesses;
CREATE POLICY "businesses_public_read"
  ON public.businesses AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Customers can view business by slug" ON public.businesses;
CREATE POLICY "Customers can view business by slug"
  ON public.businesses AS PERMISSIVE FOR SELECT TO public USING (true);

-- ── staff ─────────────────────────────────────────────────────────────────────
-- Needed by: booking flow staff picker, staff schedule self-read
DROP POLICY IF EXISTS "staff_public_read" ON public.staff;
CREATE POLICY "staff_public_read"
  ON public.staff AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "staff_all" ON public.staff;
CREATE POLICY "staff_all"
  ON public.staff AS PERMISSIVE FOR ALL TO public
  USING ((business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid())) OR (user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()));

-- ── cashapp_settings ─────────────────────────────────────────────────────────
-- Needed by: customer-info page reads fee_mode to display pricing
DROP POLICY IF EXISTS "cashapp_public_read" ON public.cashapp_settings;
CREATE POLICY "cashapp_public_read"
  ON public.cashapp_settings AS PERMISSIVE FOR SELECT TO public USING (true);
