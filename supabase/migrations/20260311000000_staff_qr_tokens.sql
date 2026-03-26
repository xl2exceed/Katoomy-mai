-- Staff QR login tokens: server pre-exchanges magic link session, stores here for client pickup.
-- Tokens expire in 5 minutes and are single-use.
CREATE TABLE IF NOT EXISTS public.staff_qr_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  used boolean DEFAULT false NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Deny all direct access; only service role can read/write
ALTER TABLE public.staff_qr_tokens ENABLE ROW LEVEL SECURITY;
