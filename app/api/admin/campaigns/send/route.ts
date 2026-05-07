// POST /api/admin/campaigns/send
// Executes a campaign — sends (or simulates) SMS to all resolved recipients.
// Enforces: time-of-day window, monthly cap, content filter, opt-out list.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTwilio, getRouting } from "@/lib/twilio";
import { canSendSms } from "@/lib/sms/canSendSms";
import { checkContent } from "@/lib/sms/contentFilter";
import { resolveAudience } from "../preview/route";

const PLATFORM_MONTHLY_LIMIT = 500; // default per business; override via businesses.sms_monthly_limit

function resolveMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Check that current time in the business's timezone is between 8am and 9pm (TCPA). */
function isWithinSendWindow(timezone: string): boolean {
  const now = new Date();
  const hour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone }),
    10,
  );
  return hour >= 8 && hour < 21;
}

/** Count marketing SMS sent by this business in the current calendar month. */
async function getMonthlyUsage(businessId: string): Promise<number> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabaseAdmin
    .from("sms_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["sent", "simulated"])
    .gte("sent_at", firstOfMonth);
  return count ?? 0;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug, timezone, sms_monthly_limit")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  const { data: campaign } = await supabaseAdmin
    .from("sms_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Campaign already sent" }, { status: 400 });

  // ── Compliance gate 1: time-of-day (TCPA) ──────────────────────────────────
  const timezone = business.timezone || "America/New_York";
  if (!isWithinSendWindow(timezone)) {
    return NextResponse.json(
      { error: "Messages can only be sent between 8:00 AM and 9:00 PM in the business's local time (TCPA compliance)." },
      { status: 403 },
    );
  }

  // ── Compliance gate 2: content filter (SHAFT / 10DLC) ──────────────────────
  const contentCheck = checkContent(campaign.message_template);
  if (!contentCheck.ok) {
    return NextResponse.json(
      { error: `Message blocked: contains prohibited content (${contentCheck.category}). Remove this content and try again.` },
      { status: 403 },
    );
  }

  // ── Compliance gate 3: monthly cap ─────────────────────────────────────────
  const monthlyLimit = business.sms_monthly_limit ?? PLATFORM_MONTHLY_LIMIT;
  const currentUsage = await getMonthlyUsage(business.id);
  if (currentUsage >= monthlyLimit) {
    return NextResponse.json(
      { error: `Monthly SMS limit reached (${monthlyLimit} messages). Your limit resets on the 1st of next month.` },
      { status: 403 },
    );
  }

  // Resolve audience
  const customers = await resolveAudience(business.id, campaign.audience_type, campaign.audience_config || {});
  if (customers.length === 0) {
    return NextResponse.json({ error: "No customers match this audience" }, { status: 400 });
  }

  // Cap the send at whatever headroom remains this month
  const headroom = monthlyLimit - currentUsage;
  const sendList = customers.slice(0, headroom);
  const cappedAt = sendList.length < customers.length ? sendList.length : null;

  // Mark campaign as sending
  await supabaseAdmin
    .from("sms_campaigns")
    .update({ status: "sending", total_recipients: sendList.length })
    .eq("id", campaignId);

  const { client, mode } = getTwilio();
  const routing = getRouting(mode);
  const isSimulated = mode === "TEST";
  const fromNumber = "from" in routing ? routing.from : ("messagingServiceSid" in routing ? routing.messagingServiceSid : null);
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";
  const bookingLink = `${origin}/${business.slug}`;

  let sentCount = 0, failedCount = 0, skippedCount = 0;

  for (const customer of sendList) {
    const phone = customer.phone.replace(/\D/g, "");
    if (phone.length < 10) { failedCount++; continue; }

    const to = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;

    // Per-number opt-out and health check
    const { ok: canSend, reason } = await canSendSms(to);
    if (!canSend) {
      await supabaseAdmin.from("sms_campaign_recipients").insert({
        campaign_id: campaignId,
        business_id: business.id,
        customer_id: customer.id,
        phone: to,
        message: "",
        status: "skipped",
        error_message: reason,
      });
      skippedCount++;
      continue;
    }

    const message = resolveMessage(campaign.message_template, {
      name: customer.full_name?.split(" ")[0] || "there",
      full_name: customer.full_name || "there",
      business: business.name,
      booking_link: bookingLink,
    });

    try {
      const msg = await client.messages.create({ to, ...routing, body: message });

      const { data: smsRecord } = await supabaseAdmin
        .from("sms_messages")
        .insert({
          business_id: business.id,
          direction: "outbound",
          from_number: fromNumber,
          to_number: to,
          body: message,
          provider: "twilio",
          provider_message_id: msg.sid,
          status: msg.status ?? "queued",
        })
        .select("id")
        .single();

      await supabaseAdmin.from("sms_campaign_recipients").insert({
        campaign_id: campaignId,
        business_id: business.id,
        customer_id: customer.id,
        phone: to,
        message,
        status: isSimulated ? "simulated" : "sent",
        sms_message_id: smsRecord?.id ?? null,
        sent_at: new Date().toISOString(),
      });

      sentCount++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("sms_campaign_recipients").insert({
        campaign_id: campaignId,
        business_id: business.id,
        customer_id: customer.id,
        phone: to,
        message,
        status: "failed",
        error_message: errorMessage,
      });
      failedCount++;
    }
  }

  await supabaseAdmin
    .from("sms_campaigns")
    .update({
      status: "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      simulated: isSimulated,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return NextResponse.json({
    ok: true,
    simulated: isSimulated,
    totalRecipients: sendList.length,
    sentCount,
    failedCount,
    skippedCount,
    ...(cappedAt !== null ? { warning: `Monthly limit reached mid-campaign. Only ${cappedAt} of ${customers.length} recipients were messaged.` } : {}),
  });
}
