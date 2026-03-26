import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Twilio posts status callbacks as URL-encoded form data.
// Called for every status transition on outbound messages.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const messageSid = String(formData.get("MessageSid") ?? "");
    const rawStatus = String(formData.get("MessageStatus") ?? "").toLowerCase();
    const errorCode = formData.get("ErrorCode") ? Number(formData.get("ErrorCode")) : null;
    const errorMessage = String(formData.get("ErrorMessage") ?? "") || null;
    const to = String(formData.get("To") ?? "") || null;

    if (!messageSid) {
      return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
    }

    const isFinal = rawStatus === "delivered" || rawStatus === "undelivered" || rawStatus === "failed";

    // Update the sms_messages row
    const updatePayload: Record<string, unknown> = {
      status: rawStatus,
      updated_at: new Date().toISOString(),
    };
    if (errorCode !== null) updatePayload.error_code = errorCode;
    if (errorMessage) updatePayload.error_message = errorMessage;
    if (rawStatus === "delivered") updatePayload.delivered_at = new Date().toISOString();

    await supabaseAdmin
      .from("sms_messages")
      .update(updatePayload)
      .eq("provider_message_id", messageSid);

    // Only act on final statuses
    if (!isFinal) return NextResponse.json({ ok: true });

    // Resolve the phone number — prefer the To field from Twilio,
    // fall back to what we stored in the DB.
    let normalizedPhone = to;
    if (!normalizedPhone) {
      const { data: row } = await supabaseAdmin
        .from("sms_messages")
        .select("to_number")
        .eq("provider_message_id", messageSid)
        .maybeSingle();
      normalizedPhone = row?.to_number ?? null;
    }

    if (!normalizedPhone) return NextResponse.json({ ok: true });

    if (rawStatus === "failed" || rawStatus === "undelivered") {
      // Increment failure count and potentially block the number
      const { data: existing } = await supabaseAdmin
        .from("phone_health")
        .select("failure_count")
        .eq("normalized_phone", normalizedPhone)
        .maybeSingle();

      const nextCount = (existing?.failure_count ?? 0) + 1;

      await supabaseAdmin.from("phone_health").upsert({
        normalized_phone: normalizedPhone,
        failure_count: nextCount,
        send_blocked: nextCount >= 3,       // hard block at 3 failures
        last_failure_at: new Date().toISOString(),
        last_error_code: errorCode ?? null,
        last_error_message: errorMessage ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    if (rawStatus === "delivered") {
      // Record successful delivery — does NOT reset failure_count
      // (a number that was flaky stays risky even if one message gets through)
      await supabaseAdmin.from("phone_health").upsert({
        normalized_phone: normalizedPhone,
        last_delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Twilio status callback error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
