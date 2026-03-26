import { createClient } from "@supabase/supabase-js";

function required(name: string, value?: string) {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

// 🔑 Use fallback logic here
const supabaseUrl =
  (process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim()) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

export const supabaseAdmin = createClient(
  required("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)", supabaseUrl),
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  {
    auth: { persistSession: false },
  },
);
