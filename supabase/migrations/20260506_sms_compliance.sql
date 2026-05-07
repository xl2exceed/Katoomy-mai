-- Global SMS opt-out registry.
-- When a customer texts STOP, their phone is added here and they are
-- never texted again from any business on the platform.
CREATE TABLE IF NOT EXISTS sms_optouts (
  phone          TEXT PRIMARY KEY,            -- E.164 format (+1XXXXXXXXXX)
  opted_out_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_back_in_at TIMESTAMPTZ,
  is_opted_out   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Per-business monthly SMS cap override.
-- NULL means use the platform default (500). Set higher for paid plans.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sms_monthly_limit INTEGER DEFAULT NULL;

-- Index for fast opt-out lookups on every send
CREATE INDEX IF NOT EXISTS idx_sms_optouts_phone ON sms_optouts (phone) WHERE is_opted_out = TRUE;
