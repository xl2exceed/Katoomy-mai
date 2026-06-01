-- Persists hub (network) offer claims per customer so they survive localStorage
-- clearing and appear in the customer's offers page for up to 15 days.
CREATE TABLE IF NOT EXISTS network_offer_claims (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id        UUID NOT NULL REFERENCES network_offers(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  via_business_id UUID REFERENCES businesses(id),
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  redeemed_at     TIMESTAMPTZ,
  booking_id      UUID REFERENCES bookings(id),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed')),
  UNIQUE(offer_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_noc_customer_id ON network_offer_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_noc_status_expires ON network_offer_claims(status, expires_at);
