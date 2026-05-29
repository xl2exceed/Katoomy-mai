-- Track whether a business has been placed into a network by the auto-placement algorithm.
-- Stays false if placement fails, so the Katoomy admin panel can surface unplaced businesses.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS network_placed BOOLEAN NOT NULL DEFAULT FALSE;

GRANT ALL ON businesses TO service_role;
