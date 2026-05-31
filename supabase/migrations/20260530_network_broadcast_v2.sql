-- Network Broadcast v2
-- Adds offer tracking, per-customer discount entitlements, and monthly credit system.

-- Extend network_broadcasts with offer details
ALTER TABLE network_broadcasts
  ADD COLUMN IF NOT EXISTS template_key       TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS offer_text         TEXT,
  ADD COLUMN IF NOT EXISTS offer_discount_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fee_cents INT NOT NULL DEFAULT 0;

-- Extend network_broadcast_log with per-customer discount entitlements
ALTER TABLE network_broadcast_log
  ADD COLUMN IF NOT EXISTS texts_this_month    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_discount_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_id          UUID;

-- Monthly broadcast credits per business (1 free/month, track paid extras)
CREATE TABLE IF NOT EXISTS network_broadcast_credits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month_year   TEXT NOT NULL,   -- e.g. '2026-05'
  free_used    INT  NOT NULL DEFAULT 0,
  paid_used    INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, month_year)
);

-- RLS: deny all direct access; service_role does everything
ALTER TABLE network_broadcast_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_network_broadcast_credits
  ON network_broadcast_credits FOR ALL USING (false);

GRANT ALL ON network_broadcast_credits TO service_role;
GRANT ALL ON network_broadcasts        TO service_role;
GRANT ALL ON network_broadcast_log     TO service_role;
