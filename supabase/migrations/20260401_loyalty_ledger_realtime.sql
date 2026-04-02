-- Enable Supabase real-time for loyalty_ledger so customer dashboards
-- update points instantly when staff/admin marks a booking complete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'loyalty_ledger'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.loyalty_ledger;
  END IF;
END;
$$;

ALTER TABLE public.loyalty_ledger REPLICA IDENTITY FULL;
