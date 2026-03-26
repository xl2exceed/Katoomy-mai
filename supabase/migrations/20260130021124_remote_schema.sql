


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."booking_status" AS ENUM (
    'requested',
    'confirmed',
    'rescheduled',
    'cancelled',
    'completed',
    'no_show'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."deposit_type" AS ENUM (
    'flat',
    'percent'
);


ALTER TYPE "public"."deposit_type" OWNER TO "postgres";


CREATE TYPE "public"."loyalty_event_type" AS ENUM (
    'booking',
    'completion',
    'referral',
    'manual_adjustment',
    'redeem'
);


ALTER TYPE "public"."loyalty_event_type" OWNER TO "postgres";


CREATE TYPE "public"."onboarding_mode" AS ENUM (
    'fast',
    'full'
);


ALTER TYPE "public"."onboarding_mode" OWNER TO "postgres";


CREATE TYPE "public"."onboarding_status" AS ENUM (
    'in_progress',
    'completed'
);


ALTER TYPE "public"."onboarding_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'requires_payment_method',
    'requires_confirmation',
    'processing',
    'succeeded',
    'canceled',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."referral_status" AS ENUM (
    'invited',
    'installed',
    'account_created',
    'booked',
    'paid',
    'completed_confirmed',
    'rewarded',
    'invalid'
);


ALTER TYPE "public"."referral_status" OWNER TO "postgres";


CREATE TYPE "public"."reward_type" AS ENUM (
    'discount',
    'free_service',
    'custom_prize'
);


ALTER TYPE "public"."reward_type" OWNER TO "postgres";


CREATE TYPE "public"."stripe_account_status" AS ENUM (
    'connected',
    'pending',
    'restricted',
    'not_connected'
);


ALTER TYPE "public"."stripe_account_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_business_id"("customer_uuid" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT business_id FROM customers WHERE id = customer_uuid);
END;
$$;


ALTER FUNCTION "public"."get_customer_business_id"("customer_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_business_owner"("business_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM businesses
    WHERE id = business_uuid AND owner_user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_business_owner"("business_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."automated_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "reminder_enabled" boolean DEFAULT false,
    "reminder_hours_before" integer DEFAULT 24,
    "reminder_message" "text",
    "winback_enabled" boolean DEFAULT false,
    "winback_days_inactive" integer DEFAULT 30,
    "winback_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automated_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "day_of_week" integer,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "buffer_minutes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "days_open" "text"[],
    CONSTRAINT "availability_rules_buffer_minutes_check" CHECK (("buffer_minutes" >= 0)),
    CONSTRAINT "availability_rules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."availability_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "start_ts" timestamp with time zone NOT NULL,
    "end_ts" timestamp with time zone NOT NULL,
    "status" "public"."booking_status" DEFAULT 'requested'::"public"."booking_status",
    "total_price_cents" integer NOT NULL,
    "deposit_required" boolean DEFAULT false,
    "deposit_amount_cents" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_notes" "text",
    "staff_id" "uuid",
    CONSTRAINT "bookings_deposit_amount_cents_check" CHECK (("deposit_amount_cents" >= 0)),
    CONSTRAINT "bookings_total_price_cents_check" CHECK (("total_price_cents" >= 0))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_features" (
    "business_id" "uuid" NOT NULL,
    "deposits_enabled" boolean DEFAULT false,
    "loyalty_enabled" boolean DEFAULT false,
    "referrals_enabled" boolean DEFAULT false,
    "feedback_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "app_name" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#3B82F6'::"text",
    "welcome_message" "text",
    "push_sender_name" "text",
    "timezone" "text" DEFAULT 'America/New_York'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_name" "text",
    "owner_phone" "text",
    "owner_email" "text",
    "subscription_plan" "text" DEFAULT 'free'::"text",
    "features" "jsonb" DEFAULT '{"staff_management": false, "advanced_analytics": false, "automated_messaging": false}'::"jsonb",
    CONSTRAINT "businesses_subscription_plan_check" CHECK (("subscription_plan" = ANY (ARRAY['free'::"text", 'premium'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_policies" (
    "business_id" "uuid" NOT NULL,
    "policy_text" "text" NOT NULL,
    "min_cancel_notice_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cancellation_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "phone" "text" NOT NULL,
    "email" "text",
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "referral_code" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deposit_settings" (
    "business_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false,
    "type" "public"."deposit_type" DEFAULT 'flat'::"public"."deposit_type",
    "amount_cents" integer,
    "percent" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deposit_settings_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "deposit_settings_percent_check" CHECK ((("percent" >= 0) AND ("percent" <= 100)))
);


ALTER TABLE "public"."deposit_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "rating" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_ledger" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "public"."loyalty_event_type" NOT NULL,
    "points_delta" integer NOT NULL,
    "related_booking_id" "uuid",
    "related_referral_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_settings" (
    "business_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false,
    "earn_on_booking" boolean DEFAULT false,
    "earn_on_completion" boolean DEFAULT true,
    "earn_on_referral" boolean DEFAULT true,
    "points_per_event" integer DEFAULT 1,
    "threshold_points" integer DEFAULT 10,
    "reward_type" "public"."reward_type" DEFAULT 'discount'::"public"."reward_type",
    "reward_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "referrer_reward_points" integer DEFAULT 15,
    "referral_enabled" boolean DEFAULT true,
    CONSTRAINT "loyalty_settings_points_per_event_check" CHECK (("points_per_event" >= 0)),
    CONSTRAINT "loyalty_settings_threshold_points_check" CHECK (("threshold_points" >= 0))
);


ALTER TABLE "public"."loyalty_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "business_id" "uuid" NOT NULL,
    "booking_confirmations" boolean DEFAULT true,
    "appointment_reminders" boolean DEFAULT true,
    "cancellation_notices" boolean DEFAULT true,
    "promotions" boolean DEFAULT false,
    "loyalty_updates" boolean DEFAULT true,
    "channels" "text"[] DEFAULT ARRAY['email'::"text", 'push'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_state" (
    "business_id" "uuid" NOT NULL,
    "mode" "public"."onboarding_mode" DEFAULT 'fast'::"public"."onboarding_mode",
    "current_step" "text" NOT NULL,
    "completed_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "answers" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."onboarding_status" DEFAULT 'in_progress'::"public"."onboarding_status",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text",
    "amount_cents" integer NOT NULL,
    "status" "public"."payment_status" DEFAULT 'requires_payment_method'::"public"."payment_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_amount_cents_check" CHECK (("amount_cents" >= 0))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "referrer_customer_id" "uuid" NOT NULL,
    "referred_customer_id" "uuid" NOT NULL,
    "referral_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reward_points_awarded" integer DEFAULT 0,
    "first_completed_booking_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "check_not_self_referral" CHECK (("referrer_customer_id" <> "referred_customer_id")),
    CONSTRAINT "check_valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "duration_minutes" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "services_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "services_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text",
    "phone" "text",
    "email" "text",
    "photo_url" "text",
    "is_active" boolean DEFAULT true,
    "working_hours" "jsonb" DEFAULT '{"friday": {"end": "17:00", "start": "09:00", "enabled": true}, "monday": {"end": "17:00", "start": "09:00", "enabled": true}, "sunday": {"end": "17:00", "start": "09:00", "enabled": false}, "tuesday": {"end": "17:00", "start": "09:00", "enabled": true}, "saturday": {"end": "17:00", "start": "09:00", "enabled": true}, "thursday": {"end": "17:00", "start": "09:00", "enabled": true}, "wednesday": {"end": "17:00", "start": "09:00", "enabled": true}}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_connect_accounts" (
    "business_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "charges_enabled" boolean DEFAULT false,
    "payouts_enabled" boolean DEFAULT false,
    "details_submitted" boolean DEFAULT false,
    "status" "public"."stripe_account_status" DEFAULT 'not_connected'::"public"."stripe_account_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_connect_accounts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."automated_messages"
    ADD CONSTRAINT "automated_messages_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."automated_messages"
    ADD CONSTRAINT "automated_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_business_id_day_of_week_key" UNIQUE ("business_id", "day_of_week");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_features"
    ADD CONSTRAINT "business_features_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_phone_key" UNIQUE ("business_id", "phone");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."deposit_settings"
    ADD CONSTRAINT "deposit_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_connect_accounts"
    ADD CONSTRAINT "stripe_connect_accounts_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."stripe_connect_accounts"
    ADD CONSTRAINT "stripe_connect_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");



CREATE INDEX "idx_availability_business" ON "public"."availability_rules" USING "btree" ("business_id");



CREATE INDEX "idx_bookings_business" ON "public"."bookings" USING "btree" ("business_id");



CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id");



CREATE INDEX "idx_bookings_service" ON "public"."bookings" USING "btree" ("service_id");



CREATE INDEX "idx_bookings_staff_id" ON "public"."bookings" USING "btree" ("staff_id");



CREATE INDEX "idx_bookings_start_ts" ON "public"."bookings" USING "btree" ("business_id", "start_ts");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("business_id", "status");



CREATE INDEX "idx_businesses_owner" ON "public"."businesses" USING "btree" ("owner_user_id");



CREATE INDEX "idx_businesses_slug" ON "public"."businesses" USING "btree" ("slug");



CREATE INDEX "idx_customers_business" ON "public"."customers" USING "btree" ("business_id");



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("business_id", "phone");



CREATE INDEX "idx_customers_referral_code" ON "public"."customers" USING "btree" ("referral_code");



CREATE INDEX "idx_customers_user" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_feedback_booking" ON "public"."feedback" USING "btree" ("booking_id");



CREATE INDEX "idx_feedback_business" ON "public"."feedback" USING "btree" ("business_id");



CREATE INDEX "idx_feedback_created" ON "public"."feedback" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "idx_feedback_customer" ON "public"."feedback" USING "btree" ("customer_id");



CREATE INDEX "idx_loyalty_ledger_business" ON "public"."loyalty_ledger" USING "btree" ("business_id");



CREATE INDEX "idx_loyalty_ledger_created" ON "public"."loyalty_ledger" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_loyalty_ledger_customer" ON "public"."loyalty_ledger" USING "btree" ("customer_id");



CREATE INDEX "idx_payments_booking" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_business" ON "public"."payments" USING "btree" ("business_id");



CREATE INDEX "idx_payments_stripe_pi" ON "public"."payments" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_referrals_business_id" ON "public"."referrals" USING "btree" ("business_id");



CREATE INDEX "idx_referrals_referred_customer_id" ON "public"."referrals" USING "btree" ("referred_customer_id");



CREATE INDEX "idx_referrals_referrer_customer_id" ON "public"."referrals" USING "btree" ("referrer_customer_id");



CREATE INDEX "idx_referrals_status" ON "public"."referrals" USING "btree" ("status");



CREATE INDEX "idx_services_active" ON "public"."services" USING "btree" ("business_id", "active");



CREATE INDEX "idx_services_business" ON "public"."services" USING "btree" ("business_id");



CREATE INDEX "idx_staff_business_id" ON "public"."staff" USING "btree" ("business_id");



CREATE INDEX "idx_staff_is_active" ON "public"."staff" USING "btree" ("is_active");



CREATE INDEX "idx_stripe_accounts_stripe_id" ON "public"."stripe_connect_accounts" USING "btree" ("stripe_account_id");



CREATE OR REPLACE TRIGGER "update_availability_rules_updated_at" BEFORE UPDATE ON "public"."availability_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_business_features_updated_at" BEFORE UPDATE ON "public"."business_features" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_businesses_updated_at" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cancellation_policies_updated_at" BEFORE UPDATE ON "public"."cancellation_policies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deposit_settings_updated_at" BEFORE UPDATE ON "public"."deposit_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_loyalty_settings_updated_at" BEFORE UPDATE ON "public"."loyalty_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_settings_updated_at" BEFORE UPDATE ON "public"."notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_onboarding_state_updated_at" BEFORE UPDATE ON "public"."onboarding_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stripe_connect_accounts_updated_at" BEFORE UPDATE ON "public"."stripe_connect_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."automated_messages"
    ADD CONSTRAINT "automated_messages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_features"
    ADD CONSTRAINT "business_features_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deposit_settings"
    ADD CONSTRAINT "deposit_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_first_completed_booking_id_fkey" FOREIGN KEY ("first_completed_booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_customer_id_fkey" FOREIGN KEY ("referred_customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_customer_id_fkey" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_connect_accounts"
    ADD CONSTRAINT "stripe_connect_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



CREATE POLICY "Allow checking existing points" ON "public"."loyalty_ledger" FOR SELECT USING (true);



CREATE POLICY "Allow public to create referrals" ON "public"."referrals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can create booking" ON "public"."bookings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can create customer" ON "public"."customers" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can create customer profiles" ON "public"."customers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read customers for booking" ON "public"."customers" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read loyalty settings" ON "public"."loyalty_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can update customer by phone" ON "public"."customers" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can create businesses" ON "public"."businesses" FOR INSERT WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Business owners can delete their staff" ON "public"."staff" FOR DELETE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Business owners can insert their staff" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Business owners can update their staff" ON "public"."staff" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Business owners can view their staff" ON "public"."staff" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Customers can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Customers can create feedback" ON "public"."feedback" FOR INSERT WITH CHECK ((("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))) AND (("booking_id" IS NULL) OR ("booking_id" IN ( SELECT "bookings"."id"
   FROM "public"."bookings"
  WHERE ("bookings"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Customers can update their own bookings" ON "public"."bookings" FOR UPDATE USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Customers can update their own profile" ON "public"."customers" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can view active services" ON "public"."services" FOR SELECT USING (("active" = true));



CREATE POLICY "Customers can view availability" ON "public"."availability_rules" FOR SELECT USING (true);



CREATE POLICY "Customers can view business by slug" ON "public"."businesses" FOR SELECT USING (true);



CREATE POLICY "Customers can view business features" ON "public"."business_features" FOR SELECT USING (true);



CREATE POLICY "Customers can view cancellation policy" ON "public"."cancellation_policies" FOR SELECT USING (true);



CREATE POLICY "Customers can view deposit settings" ON "public"."deposit_settings" FOR SELECT USING (true);



CREATE POLICY "Customers can view loyalty settings" ON "public"."loyalty_settings" FOR SELECT USING (true);



CREATE POLICY "Customers can view notification settings" ON "public"."notification_settings" FOR SELECT USING (true);



CREATE POLICY "Customers can view their own feedback" ON "public"."feedback" FOR SELECT USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Customers can view their own loyalty points" ON "public"."loyalty_ledger" FOR SELECT USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Customers can view their own payments" ON "public"."payments" FOR SELECT USING (("booking_id" IN ( SELECT "bookings"."id"
   FROM "public"."bookings"
  WHERE ("bookings"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers can view their own profile" ON "public"."customers" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners can insert loyalty points" ON "public"."loyalty_ledger" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can manage their availability" ON "public"."availability_rules" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their business features" ON "public"."business_features" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their cancellation policy" ON "public"."cancellation_policies" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their deposit settings" ON "public"."deposit_settings" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their loyalty settings" ON "public"."loyalty_settings" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their notification settings" ON "public"."notification_settings" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their onboarding state" ON "public"."onboarding_state" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can manage their services" ON "public"."services" USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can read all bookings data" ON "public"."bookings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "bookings"."business_id") AND ("businesses"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read all loyalty data" ON "public"."loyalty_ledger" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "loyalty_ledger"."business_id") AND ("businesses"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read customers for their business" ON "public"."customers" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can read their services" ON "public"."services" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update their bookings" ON "public"."bookings" FOR UPDATE USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can update their customers" ON "public"."customers" FOR UPDATE USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can update their own business" ON "public"."businesses" FOR UPDATE USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Owners can update their referrals" ON "public"."referrals" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view feedback for their business" ON "public"."feedback" FOR SELECT USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can view their Stripe account" ON "public"."stripe_connect_accounts" FOR SELECT USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can view their customers" ON "public"."customers" FOR SELECT USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can view their loyalty ledger" ON "public"."loyalty_ledger" FOR SELECT USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can view their own business" ON "public"."businesses" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Owners can view their payments" ON "public"."payments" FOR SELECT USING ("public"."is_business_owner"("business_id"));



CREATE POLICY "Owners can view their referrals" ON "public"."referrals" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners read bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "bookings"."business_id") AND ("businesses"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Public can check availability" ON "public"."bookings" FOR SELECT USING (true);



CREATE POLICY "Public can lookup by referral code" ON "public"."customers" FOR SELECT USING (("referral_code" IS NOT NULL));



CREATE POLICY "Public can view active staff" ON "public"."staff" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Service role can manage Stripe accounts" ON "public"."stripe_connect_accounts" USING (("auth"."uid"() IS NULL));



CREATE POLICY "Service role can manage loyalty ledger" ON "public"."loyalty_ledger" USING (("auth"."uid"() IS NULL));



CREATE POLICY "Service role can manage payments" ON "public"."payments" USING (("auth"."uid"() IS NULL));



ALTER TABLE "public"."automated_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cancellation_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deposit_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_connect_accounts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_customer_business_id"("customer_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_business_id"("customer_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_business_id"("customer_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."automated_messages" TO "anon";
GRANT ALL ON TABLE "public"."automated_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."automated_messages" TO "service_role";



GRANT ALL ON TABLE "public"."availability_rules" TO "anon";
GRANT ALL ON TABLE "public"."availability_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_rules" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."business_features" TO "anon";
GRANT ALL ON TABLE "public"."business_features" TO "authenticated";
GRANT ALL ON TABLE "public"."business_features" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."cancellation_policies" TO "anon";
GRANT ALL ON TABLE "public"."cancellation_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."cancellation_policies" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."deposit_settings" TO "anon";
GRANT ALL ON TABLE "public"."deposit_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."deposit_settings" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_ledger" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_settings" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_state" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_state" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_state" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_connect_accounts" TO "anon";
GRANT ALL ON TABLE "public"."stripe_connect_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_connect_accounts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "Anyone can create booking" on "public"."bookings";

drop policy "Anyone can create customer" on "public"."customers";

drop policy "Anyone can read customers for booking" on "public"."customers";

drop policy "Anyone can update customer by phone" on "public"."customers";

drop policy "Public can view active staff" on "public"."staff";


  create policy "Anyone can create booking"
  on "public"."bookings"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Anyone can create customer"
  on "public"."customers"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Anyone can read customers for booking"
  on "public"."customers"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can update customer by phone"
  on "public"."customers"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Public can view active staff"
  on "public"."staff"
  as permissive
  for select
  to anon, authenticated
using ((is_active = true));



  create policy "Authenticated users can upload 1140yeo_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'business-assets'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Public Access 1140yeo_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'business-assets'::text));



