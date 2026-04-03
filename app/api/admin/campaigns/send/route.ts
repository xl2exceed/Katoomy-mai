// POST /api/admin/campaigns/send
// Executes a campaign -- sends (or simulates) SMS to all resolved recipients.
// Uses TWILIO_MODE env var: TEST = logged/simulated, LIVE = real SMS sent.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTwilio, getFromNumber } from "@/lib/twilio";
import { resolveAudience } from "../preview/route";

function resolveMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
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

  // Resolve audience
  const customers = await resolveAudience(business.id, campaign.audience_type, campaign.audience_config || {});
  if (customers.length === 0) {
    return NextResponse.json({ error: "No customers match this audience" }, { status: 400 });
  }

  // Mark campaign as sending
  await supabaseAdmin
    .from("sms_campaigns")
    .update({ status: "sending", total_recipients: customers.length })
    .eq("id", campaignId);

  const { client, mode } = getTwilio();
  const from = getFromNumber(mode);
  const isSimulated = mode === "TEST";
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";
  const bookingLink = `${origin}/${business.slug}`;

  let sentCount = 0, failedCount = 0;

  for (const customer of customers) {
    const phone = customer.phone.replace(/\D/g, "");
    if (phone.length < 10) { failedCount++; continue; }

    const to = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
    const message = resolveMessage(campaign.message_template, {
      name: customer.full_name?.split(" ")[0] || "there",
      full_name: customer.full_name || "there",
      business: business.name,
      booking_link: bookingLink,
    });

    try {
      const msg = await client.messages.create({ to, from, body: message });

      // Log to sms_messages (existing table)
      const { data: smsRecord } = await supabaseAdmin
        .from("sms_messages")
        .insert({
          business_id: business.id,
          direction: "outbound",
          from_number: from,
          to_number: to,
          body: message,
          provider: "twilio",
          provider_message_id: msg.sid,
          status: msg.status ?? "queued",
        })
        .select("id")
        .single();

      // Log to campaign recipients
      await supabaseAdmin
        .from("sms_campaign_recipients")
        .insert({
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
      await supabaseAdmin
        .from("sms_campaign_recipients")
        .insert({
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

  // Update campaign status
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
    totalRecipients: customers.length,
    sentCount,
    failedCount,
  });
}
