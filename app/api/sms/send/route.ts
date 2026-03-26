import { NextResponse } from "next/server";
import { getTwilio, getFromNumber } from "@/lib/twilio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canSendSms } from "@/lib/sms/canSendSms";

export const runtime = "nodejs";

type SendSmsBody = {
  to?: string;
  body?: string;
  business_id?: string | null;
  customer_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const { to, body, business_id, customer_id } = (await req.json()) as SendSmsBody;

    if (!to || !body) {
      return NextResponse.json(
        { ok: false, error: "Missing to or body" },
        { status: 400 },
      );
    }

    // Normalize to E.164 (+1XXXXXXXXXX) — DB stores digits only
    const digits = to.replace(/\D/g, "");
    const normalizedTo = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

    // Block sends to numbers with 3+ delivery failures
    const { ok: canSend, reason } = await canSendSms(normalizedTo);
    if (!canSend) {
      return NextResponse.json({ ok: false, skipped: true, reason }, { status: 200 });
    }

    const { client, mode } = getTwilio();
    const from = getFromNumber(mode);

    // Attach status callback in LIVE mode so Twilio POSTs delivery updates.
    // In TEST mode the Twilio test API doesn't hit real webhooks.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const statusCallback =
      mode === "LIVE" && appUrl
        ? `${appUrl}/api/twilio/status`
        : undefined;

    const createParams: Parameters<typeof client.messages.create>[0] = {
      to: normalizedTo,
      from,
      body,
      ...(statusCallback ? { statusCallback } : {}),
    };

    const msg = await client.messages.create(createParams);

    const insertPayload = {
      business_id: business_id ?? null,
      customer_id: customer_id ?? null,
      direction: "outbound" as const,
      from_number: from,
      to_number: normalizedTo,
      body,
      provider: "twilio",
      provider_message_id: msg.sid,
      status: msg.status ?? "queued",
    };

    const { data, error } = await supabaseAdmin
      .from("sms_messages")
      .insert(insertPayload)
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({
        ok: true,
        mode,
        sid: msg.sid,
        status: msg.status,
        to: msg.to,
        from: msg.from,
        db: { ok: false, error: error.message },
      });
    }

    return NextResponse.json({
      ok: true,
      mode,
      sid: msg.sid,
      status: msg.status,
      to: msg.to,
      from: msg.from,
      db: { ok: true, id: data.id, created_at: data.created_at },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
