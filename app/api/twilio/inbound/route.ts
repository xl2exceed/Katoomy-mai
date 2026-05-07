// POST /api/twilio/inbound
// Twilio calls this when a customer sends an inbound SMS (STOP, START, HELP, etc.).
// We update our DB to stay in sync with Twilio's own opt-out registry.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import twilio from "twilio";

export const runtime = "nodejs";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  // Validate the request is genuinely from Twilio
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/inbound`;
    const rawBody = await req.text();
    const params = Object.fromEntries(new URLSearchParams(rawBody));
    const isValid = twilio.validateRequest(authToken, signature, url, params);
    if (!isValid) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    // Re-parse params from rawBody since we consumed the body
    const from: string = params["From"] ?? "";
    const body: string = (params["Body"] ?? "").trim().toUpperCase();
    return handleMessage(from, body);
  }

  // Fallback if no auth token (shouldn't happen in production)
  const formData = await req.formData();
  const from = (formData.get("From") as string) ?? "";
  const body = ((formData.get("Body") as string) ?? "").trim().toUpperCase();
  return handleMessage(from, body);
}

async function handleMessage(from: string, keyword: string): Promise<NextResponse> {
  if (!from) return twiml();

  // Normalize to E.164
  const digits = from.replace(/\D/g, "");
  const phone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  if (STOP_KEYWORDS.has(keyword)) {
    // Opt out — add to global registry and revoke consent on all customer records
    await supabaseAdmin
      .from("sms_optouts")
      .upsert({ phone, opted_out_at: new Date().toISOString(), is_opted_out: true }, { onConflict: "phone" });

    // Revoke marketing and transactional consent across all businesses
    await supabaseAdmin
      .from("customers")
      .update({
        sms_marketing_consent: false,
        sms_transactional_consent: false,
        sms_consent: false,
      })
      .eq("phone", digits); // customers table stores digits only

    // Let Twilio send its own STOP confirmation — return empty response
    return twiml();
  }

  if (START_KEYWORDS.has(keyword)) {
    // Opt back in — remove from global registry (consent must be re-given at booking)
    await supabaseAdmin
      .from("sms_optouts")
      .upsert(
        { phone, is_opted_out: false, opted_back_in_at: new Date().toISOString() },
        { onConflict: "phone" },
      );

    return twiml(
      "You have been re-subscribed to messages from Katoomy. " +
      "Reply STOP at any time to unsubscribe. Message and data rates may apply.",
    );
  }

  if (keyword === "HELP") {
    return twiml(
      "Katoomy: Reply STOP to unsubscribe from all messages. " +
      "Reply START to resubscribe. Msg&data rates may apply. " +
      "Support: support@katoomy.com",
    );
  }

  // Any other inbound message — no action, empty response
  return twiml();
}
