-- Track each email in the 3-part app-install and sms-optin sequences
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS app_install_email_2_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS app_install_email_3_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sms_optin_email_2_sent_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sms_optin_email_3_sent_at   TIMESTAMPTZ DEFAULT NULL;
