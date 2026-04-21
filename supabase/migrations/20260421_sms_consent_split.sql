-- Migration: 20260421_sms_consent_split.sql
-- Splits the single sms_consent column into two separate opt-in columns:
--   sms_transactional_consent  — appointment confirmations, reminders, service alerts
--   sms_marketing_consent      — promotional offers, win-back, referral, campaigns
--
-- The old sms_consent column is preserved for backward compatibility but is no
-- longer written to by the booking flow. Existing rows with sms_consent = true
-- are migrated: we assume they agreed to both types since they had no choice before.

-- 1. Add the two new columns
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sms_transactional_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_transactional_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_marketing_consent_at timestamptz;

-- 2. Migrate existing consented customers: if they had sms_consent = true,
--    treat them as having consented to both (they agreed to the old combined checkbox).
UPDATE customers
SET
  sms_transactional_consent    = true,
  sms_transactional_consent_at = sms_consent_at,
  sms_marketing_consent        = true,
  sms_marketing_consent_at     = sms_consent_at
WHERE sms_consent = true;

-- 3. Indexes for fast consent-filtered queries in campaign/reminder sends
CREATE INDEX IF NOT EXISTS idx_customers_sms_transactional
  ON customers (business_id, sms_transactional_consent);

CREATE INDEX IF NOT EXISTS idx_customers_sms_marketing
  ON customers (business_id, sms_marketing_consent);
