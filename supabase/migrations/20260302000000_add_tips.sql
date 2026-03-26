-- Tips table for customer gratuity payments via Stripe
CREATE TABLE IF NOT EXISTS "public"."tips" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL,
  "business_id"           uuid NOT NULL,
  "booking_id"            uuid NOT NULL,
  "customer_id"           uuid NOT NULL,
  "amount_cents"          integer NOT NULL,
  "stripe_session_id"     text NOT NULL,
  "stripe_tip_intent_id"  text,
  "status"                text NOT NULL DEFAULT 'pending',
  "created_at"            timestamp with time zone DEFAULT now(),
  CONSTRAINT "tips_pkey"               PRIMARY KEY (id),
  CONSTRAINT "tips_amount_check"       CHECK (amount_cents > 0),
  CONSTRAINT "tips_status_check"       CHECK (status IN ('pending', 'paid', 'failed')),
  CONSTRAINT "tips_stripe_session_key" UNIQUE (stripe_session_id),
  CONSTRAINT "tips_business_id_fkey"   FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT "tips_booking_id_fkey"    FOREIGN KEY (booking_id)  REFERENCES public.bookings(id)   ON DELETE CASCADE,
  CONSTRAINT "tips_customer_id_fkey"   FOREIGN KEY (customer_id) REFERENCES public.customers(id)  ON DELETE CASCADE
);

CREATE INDEX idx_tips_booking_id  ON public.tips USING btree (booking_id);
CREATE INDEX idx_tips_business_id ON public.tips USING btree (business_id);
CREATE INDEX idx_tips_customer_id ON public.tips USING btree (customer_id);
CREATE INDEX idx_tips_status      ON public.tips USING btree (status);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.tips
  USING (true) WITH CHECK (true);
