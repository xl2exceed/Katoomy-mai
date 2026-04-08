-- Add vehicle_surcharges to carwash_settings
-- Stores a surcharge in cents to add on top of the service base price per vehicle type
-- e.g. { "sedan": 0, "suv": 1000, "truck": 1000, "van": 1000, "other": 500 }
ALTER TABLE public.carwash_settings
  ADD COLUMN IF NOT EXISTS vehicle_surcharges jsonb
  DEFAULT '{"sedan": 0, "suv": 0, "truck": 0, "van": 0, "other": 0}'::jsonb;
