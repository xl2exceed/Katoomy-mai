-- Enable Supabase real-time for the bookings table so all portals receive
-- instant updates when any booking status or payment_status changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'bookings'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.bookings;
  END IF;
END;
$$;
