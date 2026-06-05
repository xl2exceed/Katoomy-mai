-- Add onboarding_completed to businesses
-- New businesses default to FALSE (will see onboarding flow)
-- All existing businesses set to TRUE immediately (they already set up manually)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

UPDATE public.businesses SET onboarding_completed = TRUE;
