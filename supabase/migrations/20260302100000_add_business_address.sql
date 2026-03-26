-- Add address field to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text;
