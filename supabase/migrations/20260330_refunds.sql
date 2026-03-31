-- Refund audit log
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id text NOT NULL,
  stripe_refund_id text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending',
  refunded_by_user_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their refunds" ON public.refunds
  FOR ALL TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
  );
