-- Network placement groups
-- Adds lat/lng to businesses and creates the group tables the auto-placement
-- algorithm uses to organise businesses into local non-competing networks.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6);

-- business_networks: one row per network group (up to 9 members, 1 niche each)
CREATE TABLE IF NOT EXISTS business_networks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_lat  DECIMAL(9,6),
  center_lng  DECIMAL(9,6),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- business_network_memberships: links a business to its network (1 network per business)
CREATE TABLE IF NOT EXISTS business_network_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id  uuid NOT NULL REFERENCES business_networks(id) ON DELETE CASCADE,
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bnm_network ON business_network_memberships (network_id);

ALTER TABLE business_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_network_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all" ON business_networks AS RESTRICTIVE FOR ALL USING (false);
CREATE POLICY "deny_all" ON business_network_memberships AS RESTRICTIVE FOR ALL USING (false);

GRANT ALL ON business_networks TO service_role;
GRANT ALL ON business_network_memberships TO service_role;
