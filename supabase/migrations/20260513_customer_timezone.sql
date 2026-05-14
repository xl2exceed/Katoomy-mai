-- Add timezone column to customers table
-- Populated silently from the browser's Intl API when a customer books or visits their dashboard.
-- Used to enforce TCPA quiet hours (8am–9pm local time) on all outbound SMS.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS timezone text;
