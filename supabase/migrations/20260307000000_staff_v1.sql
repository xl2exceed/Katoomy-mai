-- Staff v1: Add portal auth, booking fields, tips attribution, blocked time

-- 1. New columns on staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS "user_id"                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "display_name"            text,
  ADD COLUMN IF NOT EXISTS "visible_for_booking"     boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "accepting_new_clients"   boolean DEFAULT true;

-- Unique index so one auth user maps to at most one staff record
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_user_id
  ON public.staff(user_id) WHERE user_id IS NOT NULL;

-- 2. Add staff_id to tips for direct attribution
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS "staff_id" uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tips_staff_id ON public.tips USING btree (staff_id);

-- 3. staff_blocked_time: time-off, breaks, blocked slots
CREATE TABLE IF NOT EXISTS public.staff_blocked_time (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "staff_id"    uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  "business_id" uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  "start_at"    timestamptz NOT NULL,
  "end_at"      timestamptz NOT NULL,
  "reason"      text,
  "created_by"  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  "created_at"  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_time_staff
  ON public.staff_blocked_time(staff_id, start_at);

ALTER TABLE public.staff_blocked_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.staff_blocked_time
  USING (true) WITH CHECK (true);
