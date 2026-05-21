-- Add per-business toggles for the three automated campaigns
ALTER TABLE public.ai_marketing_settings
  ADD COLUMN IF NOT EXISTS app_install_sms_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS app_install_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_optin_email_enabled   BOOLEAN NOT NULL DEFAULT TRUE;
