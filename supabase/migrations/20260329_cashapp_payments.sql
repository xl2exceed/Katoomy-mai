-- ============================================================
-- Cash App Payment Feature Migration
-- Creates 3 new tables for Cash App settings, ledger, and billing
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks)
-- ============================================================

-- 1. cashapp_settings
-- Stores each business's Cash App details and fee absorption preference
CREATE TABLE IF NOT EXISTS "public"."cashapp_settings" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL UNIQUE REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "cashtag"               text,
  "phone_number"          text,
  "qr_code_url"           text,
  "fee_mode"              text DEFAULT 'pass_to_customer' NOT NULL
                            CHECK (fee_mode IN ('pass_to_customer', 'business_absorbs')),
  "enabled"               boolean DEFAULT false NOT NULL,
  "created_at"            timestamptz DEFAULT now() NOT NULL,
  "updated_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."cashapp_settings" OWNER TO "postgres";
ALTER TABLE "public"."cashapp_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can manage their cashapp_settings"
  ON "public"."cashapp_settings"
  FOR ALL
  USING (business_id IN (
    SELECT id FROM "public"."businesses" WHERE auth.uid() = owner_user_id
  ));

GRANT ALL ON TABLE "public"."cashapp_settings" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."cashapp_settings" TO "authenticated";

-- 2. alternative_payment_ledger
-- One row per completed non-credit-card appointment
CREATE TABLE IF NOT EXISTS "public"."alternative_payment_ledger" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "booking_id"            uuid REFERENCES "public"."bookings"("id") ON DELETE SET NULL,
  "customer_name"         text,
  "customer_phone"        text,
  "service_name"          text,
  "service_amount_cents"  integer NOT NULL CHECK (service_amount_cents >= 0),
  "tip_cents"             integer DEFAULT 0 NOT NULL CHECK (tip_cents >= 0),
  "platform_fee_cents"    integer DEFAULT 100 NOT NULL CHECK (platform_fee_cents >= 0),
  "payment_method"        text DEFAULT 'cashapp' NOT NULL
                            CHECK (payment_method IN ('cashapp', 'cash', 'other')),
  "fee_absorbed_by"       text DEFAULT 'customer' NOT NULL
                            CHECK (fee_absorbed_by IN ('customer', 'business')),
  "billing_month"         text NOT NULL,
  "billing_status"        text DEFAULT 'pending' NOT NULL
                            CHECK (billing_status IN ('pending', 'billed', 'waived')),
  "marked_paid_by"        uuid REFERENCES "public"."staff"("id") ON DELETE SET NULL,
  "marked_paid_at"        timestamptz DEFAULT now() NOT NULL,
  "notes"                 text,
  "created_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."alternative_payment_ledger" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "alt_ledger_business_idx"
  ON "public"."alternative_payment_ledger" USING btree ("business_id");
CREATE INDEX IF NOT EXISTS "alt_ledger_billing_month_idx"
  ON "public"."alternative_payment_ledger" USING btree ("billing_month");
CREATE INDEX IF NOT EXISTS "alt_ledger_billing_status_idx"
  ON "public"."alternative_payment_ledger" USING btree ("billing_status");

ALTER TABLE "public"."alternative_payment_ledger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can view their ledger"
  ON "public"."alternative_payment_ledger"
  FOR SELECT
  USING (business_id IN (
    SELECT id FROM "public"."businesses" WHERE auth.uid() = owner_user_id
  ));

GRANT ALL ON TABLE "public"."alternative_payment_ledger" TO "service_role";
GRANT SELECT ON TABLE "public"."alternative_payment_ledger" TO "authenticated";

-- 3. monthly_platform_billing
-- One row per business per month — tracks fee aggregation and Stripe charge
CREATE TABLE IF NOT EXISTS "public"."monthly_platform_billing" (
  "id"                    uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id"           uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "billing_month"         text NOT NULL,
  "total_transactions"    integer DEFAULT 0 NOT NULL,
  "total_fees_cents"      integer DEFAULT 0 NOT NULL CHECK (total_fees_cents >= 0),
  "stripe_charge_id"      text,
  "stripe_customer_id"    text,
  "status"                text DEFAULT 'pending' NOT NULL
                            CHECK (status IN ('pending', 'charged', 'failed', 'waived', 'no_card')),
  "failure_reason"        text,
  "charged_at"            timestamptz,
  "created_at"            timestamptz DEFAULT now() NOT NULL,
  "updated_at"            timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("business_id", "billing_month")
);

ALTER TABLE "public"."monthly_platform_billing" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "monthly_billing_business_idx"
  ON "public"."monthly_platform_billing" USING btree ("business_id");
CREATE INDEX IF NOT EXISTS "monthly_billing_status_idx"
  ON "public"."monthly_platform_billing" USING btree ("status");
CREATE INDEX IF NOT EXISTS "monthly_billing_month_idx"
  ON "public"."monthly_platform_billing" USING btree ("billing_month");

ALTER TABLE "public"."monthly_platform_billing" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can view their monthly billing"
  ON "public"."monthly_platform_billing"
  FOR SELECT
  USING (business_id IN (
    SELECT id FROM "public"."businesses" WHERE auth.uid() = owner_user_id
  ));

GRANT ALL ON TABLE "public"."monthly_platform_billing" TO "service_role";
GRANT SELECT ON TABLE "public"."monthly_platform_billing" TO "authenticated";
