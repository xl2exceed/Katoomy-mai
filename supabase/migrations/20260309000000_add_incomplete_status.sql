-- Add incomplete to the booking_status enum.
-- Auto-assigned by cron when appointment time passes with no manual status change.
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'incomplete';
