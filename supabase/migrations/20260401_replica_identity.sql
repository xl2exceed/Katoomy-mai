-- Set REPLICA IDENTITY FULL on tables used by Supabase real-time subscriptions.
-- Without this, UPDATE events only include the primary key in the event payload,
-- making column-level filters (e.g. business_id=eq.X) unreliable — events get
-- silently dropped and other portals never receive the update notification.
ALTER TABLE public.booking_payment_reports REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
