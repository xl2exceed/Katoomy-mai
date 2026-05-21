-- Track when each customer was last sent each automated email campaign.
-- Prevents duplicates from both manual and cron sends.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS app_install_email_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sms_optin_email_sent_at  TIMESTAMPTZ DEFAULT NULL;
