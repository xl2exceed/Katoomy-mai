-- Add staff RLS policy for booking_payment_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_payment_reports'
      AND policyname = 'Staff can view their business payment reports'
  ) THEN
    CREATE POLICY "Staff can view their business payment reports"
      ON public.booking_payment_reports FOR SELECT
      USING (
        business_id IN (
          SELECT business_id FROM public.staff WHERE user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- Enable Supabase real-time for this table (safe to run even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'booking_payment_reports'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.booking_payment_reports;
  END IF;
END;
$$;
