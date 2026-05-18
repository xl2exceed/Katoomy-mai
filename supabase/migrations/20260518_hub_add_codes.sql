-- hub_add_codes: short lookup codes embedded in SMS referral links.
-- Replaces the long HMAC token approach — short codes keep the SMS URL
-- under ~45 characters so carrier spam filters don't block delivery.
-- Codes expire after 7 days and are idempotent (multiple taps = same upsert).

CREATE TABLE hub_add_codes (
  code             text        PRIMARY KEY,
  phone            text        NOT NULL,
  customer_id      uuid        NOT NULL,
  business_slug    text        NOT NULL,
  biz_ref_id       uuid,
  net_ref_offer_id uuid,
  net_ref_via      uuid,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hub_add_codes_expires_idx ON hub_add_codes (expires_at);

ALTER TABLE hub_add_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON hub_add_codes AS RESTRICTIVE USING (false);
