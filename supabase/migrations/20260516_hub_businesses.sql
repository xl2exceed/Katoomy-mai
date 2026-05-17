-- hub_businesses: server-side list of businesses in each customer's hub.
-- Referral params are stored here so they survive the iOS Safari → PWA handoff.
-- Accessed only via service-role API routes; RLS denies direct client access.

CREATE TABLE hub_businesses (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_account_id   uuid        NOT NULL REFERENCES hub_accounts (id) ON DELETE CASCADE,
  business_slug    text        NOT NULL,
  biz_ref_id       uuid,
  net_ref_offer_id uuid,
  net_ref_via      uuid,
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hub_account_id, business_slug)
);

CREATE INDEX hub_businesses_account_idx ON hub_businesses (hub_account_id);

ALTER TABLE hub_businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON hub_businesses AS RESTRICTIVE USING (false);
