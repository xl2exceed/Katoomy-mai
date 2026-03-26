-- Add terminal_location_id to businesses for Stripe Terminal Tap to Pay
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS terminal_location_id text;
