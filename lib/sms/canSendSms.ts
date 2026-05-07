import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Returns whether it's safe to send an SMS to the given E.164 phone number.
 *
 * Blocking rules:
 *   1. Global opt-out (customer replied STOP)
 *   2. send_blocked = true  → hard block (3+ delivery failures)
 *   3. failure_count >= 3   → redundant safety check
 */
export async function canSendSms(
  normalizedPhone: string,
): Promise<{ ok: boolean; reason?: string }> {
  // Check global opt-out registry first — this is the legal compliance check
  const { data: optout } = await supabaseAdmin
    .from("sms_optouts")
    .select("is_opted_out")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (optout?.is_opted_out) {
    return { ok: false, reason: "Number has opted out (STOP received)" };
  }

  // Check delivery health
  const { data: health } = await supabaseAdmin
    .from("phone_health")
    .select("failure_count, send_blocked")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  if (!health) return { ok: true };

  if (health.send_blocked) {
    return { ok: false, reason: "Number blocked after 3+ failed deliveries" };
  }

  if (health.failure_count >= 3) {
    return { ok: false, reason: "Number has too many delivery failures" };
  }

  return { ok: true };
}
