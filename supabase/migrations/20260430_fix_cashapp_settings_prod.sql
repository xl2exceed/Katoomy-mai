-- Fix cashapp_settings for production database
-- Adds missing UNIQUE constraint on business_id and Zelle columns
-- Safe to run on both old and new databases (all ops are idempotent)

-- 1. Create table if it doesn't exist yet (new prod DB may not have it)
CREATE TABLE IF NOT EXISTS "public"."cashapp_settings" (
  "id"          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "cashtag"     text,
  "phone_number" text,
  "qr_code_url" text,
  "fee_mode"    text DEFAULT 'pass_to_customer' NOT NULL
                  CHECK (fee_mode IN ('pass_to_customer', 'business_absorbs')),
  "enabled"     boolean DEFAULT false NOT NULL,
  "zelle_enabled" boolean DEFAULT false NOT NULL,
  "zelle_phone" text,
  "zelle_email" text,
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  "updated_at"  timestamptz DEFAULT now() NOT NULL
);

-- 2. Add UNIQUE constraint on business_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cashapp_settings'::regclass
      AND contype = 'u'
      AND conname = 'cashapp_settings_business_id_key'
  ) THEN
    ALTER TABLE "public"."cashapp_settings"
      ADD CONSTRAINT cashapp_settings_business_id_key UNIQUE (business_id);
  END IF;
END $$;

-- 3. Add Zelle columns if missing (for databases that have the table but not these cols)
ALTER TABLE "public"."cashapp_settings"
  ADD COLUMN IF NOT EXISTS zelle_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zelle_phone   text,
  ADD COLUMN IF NOT EXISTS zelle_email   text;

-- 4. Ensure RLS and grants
ALTER TABLE "public"."cashapp_settings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cashapp_settings'
      AND policyname = 'Business owner can manage their cashapp_settings'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Business owner can manage their cashapp_settings"
        ON "public"."cashapp_settings"
        FOR ALL
        USING (business_id IN (
          SELECT id FROM "public"."businesses" WHERE auth.uid() = owner_user_id
        ))
    $p$;
  END IF;
END $$;

GRANT ALL ON TABLE "public"."cashapp_settings" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."cashapp_settings" TO "authenticated";
