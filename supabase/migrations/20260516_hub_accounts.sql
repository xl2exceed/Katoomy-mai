-- hub_accounts: cross-business identity keyed by phone number.
-- One row per customer, shared across all businesses in their hub.
-- Accessed only via service-role API routes; RLS denies direct client access.

CREATE TABLE hub_accounts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hub_accounts_phone_idx ON hub_accounts (phone);

ALTER TABLE hub_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON hub_accounts AS RESTRICTIVE USING (false);
