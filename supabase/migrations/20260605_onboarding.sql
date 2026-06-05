-- Add onboarding_completed and branding_completed to businesses.
-- New businesses default to FALSE (will see onboarding flow).
-- All existing businesses set to TRUE so they are unaffected.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS branding_completed BOOLEAN DEFAULT FALSE;

UPDATE public.businesses SET onboarding_completed = TRUE, branding_completed = TRUE;
