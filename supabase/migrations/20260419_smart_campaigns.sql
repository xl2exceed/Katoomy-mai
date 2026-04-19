-- ============================================================
-- Smart Campaigns Migration
-- Adds automated campaign settings and a unified send log.
--
-- Strategy: Extend the existing ai_marketing_settings table
-- with new columns for each campaign type, and add a new
-- auto_campaign_log table for duplicate prevention.
--
-- New campaign types added:
--   1. Appointment Reminder (24h before — already exists in
--      scheduled_notifications, but we add an on/off toggle)
--   2. Win-back #1  — 30 days inactive (friendly check-in)
--   3. Win-back #2  — 60 days inactive (10% discount offer)
--   4. Win-back #3  — 90 days inactive (last-chance offer)
--   5. Referral nudge — 3 days after completed appointment
--   6. Re-engagement — past personal visit interval + 7 days
--      (fallback: 21 days for single-visit customers)
-- ============================================================


-- ── 1. Extend ai_marketing_settings ──────────────────────────
-- Add new columns for smart campaign toggles and templates.
-- All default to enabled (true) so new businesses get the full
-- automated experience out of the box.

ALTER TABLE "public"."ai_marketing_settings"
  -- Appointment reminder (24h before appointment)
  ADD COLUMN IF NOT EXISTS "appt_reminder_enabled"        boolean DEFAULT true NOT NULL,

  -- Win-back tier 1: 30 days inactive — friendly check-in
  ADD COLUMN IF NOT EXISTS "winback_30_enabled"           boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "winback_30_template"          text DEFAULT 'Hey {{customer_name}}! It''s been a little while since we''ve seen you at {{business_name}}. We miss you! Tap here to book your next appointment whenever you''re ready: {{booking_link}}',

  -- Win-back tier 2: 60 days inactive — discount offer
  ADD COLUMN IF NOT EXISTS "winback_60_enabled"           boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "winback_60_template"          text DEFAULT 'Hey {{customer_name}}, we haven''t seen you in a while and we want to make it worth your while to come back. Use code COMEBACK for 10% off your next visit at {{business_name}}. Book here: {{booking_link}} — offer expires in 7 days!',

  -- Win-back tier 3: 90 days inactive — last-chance offer
  ADD COLUMN IF NOT EXISTS "winback_90_enabled"           boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "winback_90_template"          text DEFAULT 'Hey {{customer_name}}, we''d love to have you back at {{business_name}}! It''s been 3 months and we''re offering you a special returning customer deal — mention this text when you book and we''ll take care of you. Book here: {{booking_link}}',

  -- Referral nudge: 3 days after completed appointment
  ADD COLUMN IF NOT EXISTS "referral_post_visit_enabled"  boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "referral_post_visit_days"     integer DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS "referral_post_visit_template" text DEFAULT 'Hey {{customer_name}}, hope you''re loving your results from {{business_name}}! If you know someone who''d love our services, send them your referral link and you''ll both get rewarded: {{referral_link}}',

  -- Re-engagement: nudge based on personal visit pattern
  ADD COLUMN IF NOT EXISTS "reengage_enabled"             boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "reengage_fallback_days"       integer DEFAULT 21 NOT NULL,
  ADD COLUMN IF NOT EXISTS "reengage_buffer_days"         integer DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS "reengage_template"            text DEFAULT 'Hey {{customer_name}}! It''s about that time — you''re usually in to see us around now. Ready to book your next appointment at {{business_name}}? It only takes a minute: {{booking_link}}',
  ADD COLUMN IF NOT EXISTS "reengage_fallback_template"   text DEFAULT 'Hey {{customer_name}}! It''s been about 3 weeks since your last visit at {{business_name}}. Whenever you''re ready to come back, booking is quick and easy: {{booking_link}}';


-- ── 2. Auto Campaign Log ──────────────────────────────────────
-- Tracks every automated campaign message sent to each customer.
-- Used to prevent duplicate sends within cooldown windows.
-- Separate from scheduled_messages so it is easy to query by
-- campaign type without polluting the general message queue.

CREATE TABLE IF NOT EXISTS "public"."auto_campaign_log" (
  "id"              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"     uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "customer_id"     uuid REFERENCES "public"."customers"("id") ON DELETE SET NULL,
  "customer_phone"  text NOT NULL,

  -- Campaign type identifier
  -- Values: 'winback_30' | 'winback_60' | 'winback_90'
  --         'referral_post_visit' | 'reengage'
  "campaign_type"   text NOT NULL,

  "message_body"    text NOT NULL,
  "status"          text DEFAULT 'sent' NOT NULL
                      CHECK (status IN ('sent', 'failed', 'skipped')),
  "error_message"   text,

  "sent_at"         timestamptz DEFAULT now() NOT NULL,
  "created_at"      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."auto_campaign_log" OWNER TO "postgres";

CREATE INDEX "auto_campaign_log_business_idx"
  ON "public"."auto_campaign_log" USING btree ("business_id");

CREATE INDEX "auto_campaign_log_customer_idx"
  ON "public"."auto_campaign_log" USING btree ("customer_id");

CREATE INDEX "auto_campaign_log_type_idx"
  ON "public"."auto_campaign_log" USING btree ("campaign_type");

CREATE INDEX "auto_campaign_log_sent_at_idx"
  ON "public"."auto_campaign_log" USING btree ("sent_at");

-- Composite index for fast duplicate-prevention queries
CREATE INDEX "auto_campaign_log_dedup_idx"
  ON "public"."auto_campaign_log" USING btree ("business_id", "customer_id", "campaign_type", "sent_at");

-- RLS: business owners can view their own logs
ALTER TABLE "public"."auto_campaign_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can view their auto_campaign_log"
  ON "public"."auto_campaign_log"
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM "public"."businesses"
      WHERE auth.uid() = owner_user_id
    )
  );

-- Service role can do everything (needed for cron writes)
GRANT ALL ON TABLE "public"."auto_campaign_log" TO "service_role";
GRANT SELECT ON TABLE "public"."auto_campaign_log" TO "authenticated";


-- ── 3. Backfill existing businesses ──────────────────────────
-- Ensure every existing business that already has an
-- ai_marketing_settings row gets the new columns populated
-- with the correct defaults (the ALTER TABLE above handles
-- new rows; this handles existing rows that were inserted
-- before the new columns existed).

UPDATE "public"."ai_marketing_settings"
SET
  appt_reminder_enabled        = COALESCE(appt_reminder_enabled, true),
  winback_30_enabled           = COALESCE(winback_30_enabled, true),
  winback_60_enabled           = COALESCE(winback_60_enabled, true),
  winback_90_enabled           = COALESCE(winback_90_enabled, true),
  referral_post_visit_enabled  = COALESCE(referral_post_visit_enabled, true),
  reengage_enabled             = COALESCE(reengage_enabled, true)
WHERE true;
