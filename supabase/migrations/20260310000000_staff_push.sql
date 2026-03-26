-- Add staff_id to push_subscriptions and allow 'staff' user_type
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_type_check;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_type_check
  CHECK (user_type = ANY (ARRAY['customer'::text, 'business'::text, 'staff'::text]));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff
  ON public.push_subscriptions USING btree (staff_id);
