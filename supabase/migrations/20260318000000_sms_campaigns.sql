-- SMS Campaigns: stores campaign definitions and per-recipient delivery records.
-- TWILIO_MODE=TEST  -> Twilio test API (no real SMS, but fully logged)
-- TWILIO_MODE=LIVE  -> real SMS sent

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id                uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name              text NOT NULL,
  message_template  text NOT NULL,
  audience_type     text NOT NULL, -- 'all' | 'at_risk' | 'members' | 'new' | 'top_spenders'
  audience_config   jsonb NOT NULL DEFAULT '{}', -- e.g. {"days_inactive":30,"top_n":20,"days_new":30}
  status            text NOT NULL DEFAULT 'draft', -- 'draft' | 'sending' | 'sent' | 'failed'
  total_recipients  integer NOT NULL DEFAULT 0,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  simulated         boolean NOT NULL DEFAULT false, -- true when TWILIO_MODE=TEST
  sent_at           timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_campaign_recipients (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id   uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES public.customers(id),
  phone         text NOT NULL,
  message       text NOT NULL, -- resolved message with variables substituted
  status        text NOT NULL DEFAULT 'pending', -- 'sent' | 'simulated' | 'failed'
  sms_message_id uuid REFERENCES public.sms_messages(id),
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_business ON public.sms_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_campaign ON public.sms_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_business ON public.sms_campaign_recipients(business_id);
