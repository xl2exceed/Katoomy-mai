// GET  /api/network/broadcast           — preview reach (partner count, customer count)
// GET  /api/network/broadcast?history=1 — recent broadcast history
// POST /api/network/broadcast           — send network marketing SMS to partner customers

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getRouting } from "@/lib/twilio";
import { isQuietHours } from "@/lib/sms/quietHours";

async function getActivePartnerIds(businessId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("network_partners")
    .select("business_a_id, business_b_id")
    .eq("status", "active")
    .or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`);

  if (!data?.length) return [];
  return data.map((p) =>
    p.business_a_id === businessId ? p.business_b_id : p.business_a_id
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_user_id", user.id)
    .single();
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const isHistory = req.nextUrl.searchParams.get("history") === "1";

  if (isHistory) {
    const { data: broadcasts } = await supabaseAdmin
      .from("network_broadcasts")
      .select("id, message, total_sent, total_failed, total_skipped, created_at")
      .eq("sending_business_id", biz.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ broadcasts: broadcasts ?? [] });
  }

  // Preview: return how many customers would receive the broadcast
  const partnerIds = await getActivePartnerIds(biz.id);
  if (!partnerIds.length) {
    return NextResponse.json({ partnerCount: 0, customerCount: 0, partners: [] });
  }

  const { count } = await supabaseAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .in("business_id", partnerIds)
    .not("phone", "is", null)
    .eq("sms_marketing_consent", true);

  const { data: partnerBizzes } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .in("id", partnerIds);

  return NextResponse.json({
    partnerCount: partnerIds.length,
    customerCount: count ?? 0,
    partners: partnerBizzes ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_user_id", user.id)
    .single();
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { message } = body as { message?: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const partnerIds = await getActivePartnerIds(biz.id);
  if (!partnerIds.length) {
    return NextResponse.json({ error: "No active partners" }, { status: 400 });
  }

  // Fetch eligible customers from all partner businesses — never exposed to sender
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, timezone, business_id")
    .in("business_id", partnerIds)
    .not("phone", "is", null)
    .eq("sms_marketing_consent", true);

  if (!customers?.length) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0, total: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
  const smsBody = `${message.trim()}\n\n— ${biz.name} | Book: ${appUrl}/${biz.slug}\nReply STOP to opt out`;

  // Create broadcast record for history tracking
  const { data: broadcast } = await supabaseAdmin
    .from("network_broadcasts")
    .insert({ sending_business_id: biz.id, message: smsBody })
    .select("id")
    .single();

  if (!broadcast) {
    return NextResponse.json({ error: "Failed to create broadcast" }, { status: 500 });
  }

  const { client: twilioClient, mode } = getTwilio();
  const routing = getRouting(mode);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const logRows: object[] = [];

  for (const customer of customers) {
    if (!customer.phone) { failed++; continue; }

    if (isQuietHours(customer.timezone)) {
      logRows.push({
        broadcast_id: broadcast.id,
        sending_business_id: biz.id,
        partner_business_id: customer.business_id,
        customer_id: customer.id,
        status: "skipped",
      });
      skipped++;
      continue;
    }

    try {
      await twilioClient.messages.create({ body: smsBody, ...routing, to: customer.phone });
      logRows.push({
        broadcast_id: broadcast.id,
        sending_business_id: biz.id,
        partner_business_id: customer.business_id,
        customer_id: customer.id,
        status: "sent",
      });
      sent++;
    } catch (err) {
      console.error(`[network-broadcast] Failed for customer ${customer.id}:`, err);
      logRows.push({
        broadcast_id: broadcast.id,
        sending_business_id: biz.id,
        partner_business_id: customer.business_id,
        customer_id: customer.id,
        status: "failed",
        error_message: String(err),
      });
      failed++;
    }
  }

  if (logRows.length > 0) {
    await supabaseAdmin.from("network_broadcast_log").insert(logRows);
  }

  await supabaseAdmin
    .from("network_broadcasts")
    .update({ total_sent: sent, total_failed: failed, total_skipped: skipped })
    .eq("id", broadcast.id);

  return NextResponse.json({ sent, failed, skipped, total: customers.length });
}
