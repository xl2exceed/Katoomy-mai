-- Network broadcast SMS feature
-- Allows any business to send marketing texts to all partner businesses' customers
-- without exposing customer phone numbers to the sending business.

-- network_broadcasts: one row per broadcast campaign (for history/reporting)
CREATE TABLE IF NOT EXISTS network_broadcasts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sending_business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message             text NOT NULL,
  total_sent          int NOT NULL DEFAULT 0,
  total_failed        int NOT NULL DEFAULT 0,
  total_skipped       int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_broadcasts_sender
  ON network_broadcasts (sending_business_id, created_at DESC);

-- network_broadcast_log: one row per customer message (for rate limiting later)
CREATE TABLE IF NOT EXISTS network_broadcast_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id        uuid NOT NULL REFERENCES network_broadcasts(id) ON DELETE CASCADE,
  sending_business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_broadcast_log_broadcast
  ON network_broadcast_log (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_network_broadcast_log_customer
  ON network_broadcast_log (customer_id, sending_business_id, created_at DESC);
