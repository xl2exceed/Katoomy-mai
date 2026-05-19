import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Unambiguous characters — no 0/O or 1/I confusion
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => CHARS[b % CHARS.length])
    .join("");
}

export interface HubCodePayload {
  phone: string;
  customerId: string;
  businessSlug: string;
  bizRefId?: string | null;
  netRefOfferId?: string | null;
  netRefVia?: string | null;
}

// Writes a short code to Supabase and returns it.
// The code goes into the SMS URL as ?c=XXXXXXXX — keeps the URL under 45 chars.
export async function createHubCode(payload: HubCodePayload): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  const { error } = await supabaseAdmin.from("hub_add_codes").insert({
    code,
    phone: payload.phone,
    customer_id: payload.customerId,
    business_slug: payload.businessSlug,
    biz_ref_id: payload.bizRefId ?? null,
    net_ref_offer_id: payload.netRefOfferId ?? null,
    net_ref_via: payload.netRefVia ?? null,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create hub code: ${error.message}`);
  return code;
}

// Looks up a code. Returns the payload if valid and not expired, null otherwise.
// Does NOT mark as used — the business upsert is idempotent, so repeat taps are fine.
export async function lookupHubCode(code: string): Promise<HubCodePayload | null> {
  const { data } = await supabaseAdmin
    .from("hub_add_codes")
    .select("phone, customer_id, business_slug, biz_ref_id, net_ref_offer_id, net_ref_via, expires_at")
    .eq("code", code)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;

  return {
    phone: data.phone,
    customerId: data.customer_id,
    businessSlug: data.business_slug,
    bizRefId: data.biz_ref_id ?? null,
    netRefOfferId: data.net_ref_offer_id ?? null,
    netRefVia: data.net_ref_via ?? null,
  };
}
