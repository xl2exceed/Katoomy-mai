-- Allow businesses to have more than one membership plan
-- Drop the unique constraint that enforced one plan per business
ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_business_id_key;
