-- Business-to-business direct customer referrals
-- Tracks when one business sends a customer (via SMS) to a partner business.

CREATE TABLE IF NOT EXISTS network_direct_referrals (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sending_business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  receiving_business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone        text        NOT NULL,
  customer_name         text,
  message               text,
  status                text        NOT NULL DEFAULT 'sent',  -- 'sent' | 'booked' | 'expired'
  booking_id            uuid        REFERENCES bookings(id),
  sent_by_user_id       uuid        REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  booked_at             timestamptz,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_ndr_sending   ON network_direct_referrals(sending_business_id);
CREATE INDEX IF NOT EXISTS idx_ndr_receiving ON network_direct_referrals(receiving_business_id);
CREATE INDEX IF NOT EXISTS idx_ndr_phone     ON network_direct_referrals(customer_phone);

ALTER TABLE network_direct_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business owners can manage their direct referrals"
ON network_direct_referrals
FOR ALL
USING (
  sending_business_id IN (
    SELECT id FROM businesses WHERE owner_user_id = auth.uid()
  )
  OR
  receiving_business_id IN (
    SELECT id FROM businesses WHERE owner_user_id = auth.uid()
  )
);
