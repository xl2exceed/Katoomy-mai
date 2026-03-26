import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Returns whether it's safe to send an SMS to the given E.164 phone number.
 *
 * Blocking rules:
 *   - send_blocked = true  → hard block (3+ failures)
 *   - failure_count >= 3   → redundant safety check
 *
 * Numbers with 1–2 failures are still allowed (risky but not blocked).
 */
export async function canSendSms(
  normalizedPhone: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { data: health } = await supabaseAdmin
    .from("phone_health")
    .select("failure_count, send_blocked")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  if (!health) return { ok: true }; // no history → fine to send

  if (health.send_blocked) {
    return { ok: false, reason: "Number blocked after 3+ failed deliveries" };
  }

  if (health.failure_count >= 3) {
    return { ok: false, reason: "Number has too many delivery failures" };
  }

  return { ok: true };
}
