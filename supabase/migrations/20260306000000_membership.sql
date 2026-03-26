-- Elite Membership: Phase 1
-- membership_plans: business-created monthly discount plans
-- member_subscriptions: customer Stripe subscriptions

CREATE TABLE IF NOT EXISTS "public"."membership_plans" (
  "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  "business_id" uuid NOT NULL UNIQUE REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "price_cents" integer NOT NULL,
  "discount_percent" integer NOT NULL DEFAULT 0,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."member_subscriptions" (
  "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "public"."membership_plans"("id"),
  "stripe_subscription_id" text NOT NULL UNIQUE,
  "stripe_customer_id" text,
  "status" text DEFAULT 'active',
  "current_period_end" timestamptz,
  "created_at" timestamptz DEFAULT now()
);
