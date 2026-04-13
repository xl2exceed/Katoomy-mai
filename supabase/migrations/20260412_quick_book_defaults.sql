-- Quick Book Defaults
-- Stores each customer's saved booking preferences (seeded from first booking)
-- One row per customer per business

CREATE TABLE IF NOT EXISTS customer_quick_book_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  booking_time TEXT NOT NULL,           -- "HH:MM" 24-hour format
  booking_day_of_week TEXT NOT NULL,    -- "monday", "tuesday", etc.
  vehicle_type TEXT,                    -- car wash only
  vehicle_condition TEXT,               -- car wash only
  addon_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, business_id)
);

ALTER TABLE customer_quick_book_defaults ENABLE ROW LEVEL SECURITY;

-- Only service role (server-side API) can access this table
-- Customers are phone-identified, not Supabase Auth users
CREATE POLICY "service_role_full_access" ON customer_quick_book_defaults
  FOR ALL TO service_role USING (true) WITH CHECK (true);
