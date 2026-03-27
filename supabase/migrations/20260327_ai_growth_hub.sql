-- ============================================================
-- AI Growth Hub Migration
-- Adds 4 new tables to Katoomy's Supabase database:
--   1. ai_marketing_settings  — per-business automation config
--   2. ai_insights            — cached AI business analysis
--   3. social_posts           — AI-generated social media content
--   4. referral_reminder_log  — tracks referral texts sent
--
-- The existing notification_rules + scheduled_messages tables
-- already handle win-back SMS — we extend them with new columns
-- rather than duplicating them.
-- ============================================================

-- ── 1. AI Marketing Settings ─────────────────────────────────
-- Stores per-business configuration for all AI-driven automation.
-- A row is created with smart defaults on first access.

CREATE TABLE IF NOT EXISTS "public"."ai_marketing_settings" (
  "id"                          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"                 uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,

  -- Win-back campaign (extends existing notification_rules)
  "winback_enabled"             boolean DEFAULT true NOT NULL,
  "winback_mode"                text DEFAULT 'automatic' NOT NULL
                                  CHECK (winback_mode IN ('automatic','manual')),
  "winback_inactive_days"       integer DEFAULT 60 NOT NULL CHECK (winback_inactive_days > 0),
  "winback_template"            text DEFAULT 'Hey {{customer_name}}! We miss you at {{business_name}}. It''s been a while — come back and book your next appointment: {{booking_link}}',
  "winback_cooldown_days"       integer DEFAULT 30 NOT NULL CHECK (winback_cooldown_days > 0),

  -- Referral reminder campaign
  "referral_enabled"            boolean DEFAULT true NOT NULL,
  "referral_mode"               text DEFAULT 'automatic' NOT NULL
                                  CHECK (referral_mode IN ('automatic','manual')),
  "referral_delay_days"         integer DEFAULT 7 NOT NULL CHECK (referral_delay_days > 0),
  "referral_template"           text DEFAULT 'Hi {{customer_name}}! Thanks for visiting {{business_name}}. Know someone who''d love our services? Refer a friend and you both get a discount: {{referral_link}}',
  "referral_cooldown_days"      integer DEFAULT 90 NOT NULL CHECK (referral_cooldown_days > 0),

  -- AI social media posting
  "social_enabled"              boolean DEFAULT false NOT NULL,
  "social_mode"                 text DEFAULT 'manual' NOT NULL
                                  CHECK (social_mode IN ('automatic','manual')),
  "social_post_frequency_days"  integer DEFAULT 3 NOT NULL,
  "social_default_platforms"    text[] DEFAULT ARRAY['instagram','facebook'],

  -- AI insights
  "insights_enabled"            boolean DEFAULT true NOT NULL,
  "insights_refresh_hours"      integer DEFAULT 24 NOT NULL,

  "created_at"                  timestamptz DEFAULT now() NOT NULL,
  "updated_at"                  timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT "ai_marketing_settings_business_id_key" UNIQUE ("business_id")
);

ALTER TABLE "public"."ai_marketing_settings" OWNER TO "postgres";

CREATE INDEX "ai_marketing_settings_business_idx"
  ON "public"."ai_marketing_settings" USING btree ("business_id");

-- RLS
ALTER TABLE "public"."ai_marketing_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can manage their ai_marketing_settings"
  ON "public"."ai_marketing_settings"
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM "public"."businesses"
      WHERE auth.uid() = owner_id
    )
  );

-- Service role bypass
GRANT ALL ON TABLE "public"."ai_marketing_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_marketing_settings" TO "authenticated";

-- Auto-update updated_at
CREATE TRIGGER "update_ai_marketing_settings_updated_at"
  BEFORE UPDATE ON "public"."ai_marketing_settings"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ── 2. AI Insights ────────────────────────────────────────────
-- Caches AI-generated business analysis so we don't call the
-- LLM on every page load. Refreshed per insights_refresh_hours.

CREATE TABLE IF NOT EXISTS "public"."ai_insights" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,

  -- The raw analytics snapshot fed to the AI (for debugging/audit)
  "analytics_snapshot"    jsonb,

  -- Array of insight objects from the AI
  "insights"              jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- AI-generated executive summary
  "summary"               text,

  -- Period this analysis covers (e.g. "Last 30 Days")
  "period_label"          text DEFAULT 'Last 30 Days',

  "generated_at"          timestamptz DEFAULT now() NOT NULL,
  "expires_at"            timestamptz,
  "created_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ai_insights" OWNER TO "postgres";

CREATE INDEX "ai_insights_business_idx"
  ON "public"."ai_insights" USING btree ("business_id");
CREATE INDEX "ai_insights_expires_idx"
  ON "public"."ai_insights" USING btree ("expires_at");

ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can view their ai_insights"
  ON "public"."ai_insights"
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM "public"."businesses"
      WHERE auth.uid() = owner_id
    )
  );

GRANT ALL ON TABLE "public"."ai_insights" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_insights" TO "authenticated";


-- ── 3. Social Posts ───────────────────────────────────────────
-- Stores AI-generated social media posts, their approval status,
-- and scheduling/publishing results.

CREATE TABLE IF NOT EXISTS "public"."social_posts" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,

  -- What triggered this post
  "source"                text DEFAULT 'ai_analytics' NOT NULL
                            CHECK (source IN ('ai_analytics','manual')),

  -- The AI-derived context used to generate this post
  "generation_context"    text,

  "platform"              text NOT NULL,
  "title"                 text,
  "content"               text NOT NULL,
  "hashtags"              text,

  "status"                text DEFAULT 'pending_approval' NOT NULL
                            CHECK (status IN (
                              'draft','pending_approval','approved',
                              'scheduled','published','failed','cancelled'
                            )),

  -- When to publish (null = immediate on approval)
  "scheduled_for"         timestamptz,
  "published_at"          timestamptz,

  -- UploadPost integration
  "uploadpost_post_id"    text,
  "uploadpost_username"   text,
  "platform_results"      jsonb,
  "error_message"         text,

  "created_at"            timestamptz DEFAULT now() NOT NULL,
  "updated_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."social_posts" OWNER TO "postgres";

CREATE INDEX "social_posts_business_idx"
  ON "public"."social_posts" USING btree ("business_id");
CREATE INDEX "social_posts_status_idx"
  ON "public"."social_posts" USING btree ("status");
CREATE INDEX "social_posts_scheduled_idx"
  ON "public"."social_posts" USING btree ("scheduled_for")
  WHERE scheduled_for IS NOT NULL;

ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can manage their social_posts"
  ON "public"."social_posts"
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM "public"."businesses"
      WHERE auth.uid() = owner_id
    )
  );

GRANT ALL ON TABLE "public"."social_posts" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."social_posts" TO "authenticated";

CREATE TRIGGER "update_social_posts_updated_at"
  BEFORE UPDATE ON "public"."social_posts"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ── 4. Referral Reminder Log ──────────────────────────────────
-- Tracks referral reminder SMS messages sent to customers.
-- Used to enforce cooldown periods and prevent over-messaging.

CREATE TABLE IF NOT EXISTS "public"."referral_reminder_log" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "customer_id"           uuid REFERENCES "public"."customers"("id") ON DELETE SET NULL,
  "customer_name"         text,
  "customer_phone"        text NOT NULL,
  "message_body"          text NOT NULL,
  "status"                text DEFAULT 'sent' NOT NULL
                            CHECK (status IN ('sent','failed','skipped')),
  "error_message"         text,
  -- Katoomy scheduled_messages UUID for delivery tracking
  "katoomy_message_id"    uuid,
  "sent_at"               timestamptz DEFAULT now() NOT NULL,
  "created_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."referral_reminder_log" OWNER TO "postgres";

CREATE INDEX "referral_reminder_log_business_idx"
  ON "public"."referral_reminder_log" USING btree ("business_id");
CREATE INDEX "referral_reminder_log_customer_idx"
  ON "public"."referral_reminder_log" USING btree ("customer_id");

ALTER TABLE "public"."referral_reminder_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can view their referral_reminder_log"
  ON "public"."referral_reminder_log"
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM "public"."businesses"
      WHERE auth.uid() = owner_id
    )
  );

GRANT ALL ON TABLE "public"."referral_reminder_log" TO "service_role";
GRANT SELECT ON TABLE "public"."referral_reminder_log" TO "authenticated";


-- ── 5. Extend notification_rules with referral kind ───────────
-- The existing kind CHECK only allows 'appointment_reminder' and
-- 'winback'. We add 'referral' so the existing win-back engine
-- can also drive referral reminders using the same infrastructure.

ALTER TABLE "public"."notification_rules"
  DROP CONSTRAINT IF EXISTS "notification_rules_kind_check";

ALTER TABLE "public"."notification_rules"
  ADD CONSTRAINT "notification_rules_kind_check"
  CHECK (kind IN ('appointment_reminder','winback','referral'));
