-- Fix network_credits.network_referral_id FK to use ON DELETE SET NULL
-- Without this, deleting a network_offer that has been used fails because
-- the cascade to network_referrals is blocked by network_credits referencing it.
-- SET NULL preserves the credit history while allowing the referral/offer to be deleted.

ALTER TABLE network_credits
  DROP CONSTRAINT IF EXISTS network_credits_network_referral_id_fkey;

ALTER TABLE network_credits
  ADD CONSTRAINT network_credits_network_referral_id_fkey
  FOREIGN KEY (network_referral_id)
  REFERENCES network_referrals(id)
  ON DELETE SET NULL;
