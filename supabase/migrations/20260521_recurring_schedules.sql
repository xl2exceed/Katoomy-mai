-- Recurring booking schedules (used by lawn care and future niches)
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id              UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id               UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  frequency                TEXT        NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  preferred_time           TEXT        NOT NULL,  -- '09:00'
  day_of_week              INTEGER     NOT NULL,  -- 0=Sunday … 6=Saturday
  property_size            TEXT        DEFAULT NULL, -- lawn care: 'small','medium','large','xl'
  price_cents              INTEGER     NOT NULL,
  addon_ids                JSONB       DEFAULT '[]'::jsonb,
  status                   TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paused', 'cancelled')),
  next_booking_date        DATE        NOT NULL,
  last_booking_created_at  TIMESTAMPTZ DEFAULT NULL,
  notes                    TEXT        DEFAULT NULL,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_business
  ON public.recurring_schedules (business_id, status);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_date
  ON public.recurring_schedules (next_booking_date)
  WHERE status = 'active';

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on recurring_schedules"
  ON public.recurring_schedules FOR ALL USING (true) WITH CHECK (true);

-- Add recurring_schedule_id to bookings so cron can detect duplicates
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID REFERENCES public.recurring_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL; -- 'recurring', 'online', 'staff', etc.
