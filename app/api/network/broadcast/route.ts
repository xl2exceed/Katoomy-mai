// GET  /api/network/broadcast           — audience segments + credits for this month
// GET  /api/network/broadcast?history=1 — recent broadcast history
// POST /api/network/broadcast           — send broadcast with new tiered system

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getRouting } from "@/lib/twilio";
import { isQuietHours } from "@/lib/sms/quietHours";

const FREE_BROADCASTS_PER_MONTH = 1;
const ADDITIONAL_BROADCAST_FEE_CENTS = 500; // $5
const SOFT_CAP = 4; // texts/month before auto-discount kicks in
const DISCOUNT_PER_TEXT_OVER_CAP_CENTS = 500; // $5 per text over cap

const TEMPLATES: Record<string, string> = {
  limited_offer: "{bizName} is offering {offer} to Katoomy network members. This week only.",
  open_slot:     "{bizName} has openings this week. Network members get {offer}.",
  seasonal:      "{bizName} special — {offer}. Katoomy network members only.",
  milestone:     "{bizName} is celebrating! {offer} for our network partners' customers.",
};

function monthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function getPartnerIds(businessId: string): Promise<string[]> {
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

async function getCredits(businessId: string) {
  const my = monthYear();
  const { data } = await supabaseAdmin
    .from("network_broadcast_credits")
    .select("free_used, paid_used")
    .eq("business_id", businessId)
    .eq("month_year", my)
    .maybeSingle();
  return { free_used: data?.free_used ?? 0, paid_used: data?.paid_used ?? 0 };
}

async function bumpCredits(businessId: string, isPaid: boolean) {
  const my = monthYear();
  const col = isPaid ? "paid_used" : "free_used";
  const { data: existing } = await supabaseAdmin
    .from("network_broadcast_credits")
    .select("id, free_used, paid_used")
    .eq("business_id", businessId)
    .eq("month_year", my)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("network_broadcast_credits")
      .update({ [col]: (existing[col as keyof typeof existing] as number) + 1 })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("network_broadcast_credits")
      .insert({ business_id: businessId, month_year: my, [col]: 1 });
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

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

  // History mode
  if (req.nextUrl.searchParams.get("history") === "1") {
    const { data: broadcasts } = await supabaseAdmin
      .from("network_broadcasts")
      .select("id, offer_text, template_key, total_sent, total_failed, total_skipped, additional_fee_cents, created_at")
      .eq("sending_business_id", biz.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ broadcasts: broadcasts ?? [] });
  }

  const partnerIds = await getPartnerIds(biz.id);
  const credits = await getCredits(biz.id);

  if (!partnerIds.length) {
    return NextResponse.json({ credits, segments: [], totalOptedIn: 0 });
  }

  // All opted-in customers across partner businesses
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id")
    .in("business_id", partnerIds)
    .not("phone", "is", null)
    .eq("sms_marketing_consent", true);

  if (!customers?.length) {
    return NextResponse.json({ credits, segments: [], totalOptedIn: 0 });
  }

  const customerIds = customers.map((c) => c.id);

  // Count network broadcast logs per customer this month
  const { data: logs } = await supabaseAdmin
    .from("network_broadcast_log")
    .select("customer_id")
    .in("customer_id", customerIds)
    .eq("status", "sent")
    .gte("created_at", monthStart());

  // Build count map
  const countMap = new Map<string, number>();
  for (const c of customers) countMap.set(c.id, 0);
  for (const log of logs ?? []) {
    countMap.set(log.customer_id, (countMap.get(log.customer_id) ?? 0) + 1);
  }

  // Group by texts_this_month
  const buckets = new Map<number, number>();
  for (const count of countMap.values()) {
    buckets.set(count, (buckets.get(count) ?? 0) + 1);
  }

  // Build sorted segments with penalty info
  const segments = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([texts, count]) => ({
      texts,
      count,
      // Penalty per redemption if this broadcast is sent to this group
      // After receiving this text they'd have texts+1; penalty kicks in above SOFT_CAP
      penaltyPerRedemptionCents: Math.max(0, (texts + 1 - SOFT_CAP) * DISCOUNT_PER_TEXT_OVER_CAP_CENTS),
    }));

  return NextResponse.json({ credits, segments, totalOptedIn: customers.length });
}

// ── POST ──────────────────────────────────────────────────────────────────────

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
  const {
    templateKey = "limited_offer",
    offerText,
    offerDiscountCents = 0,
    selectedGroups = [] as number[], // array of texts_this_month values to include
  } = body as {
    templateKey?: string;
    offerText?: string;
    offerDiscountCents?: number;
    selectedGroups?: number[];
  };

  if (!offerText?.trim()) {
    return NextResponse.json({ error: "Offer text is required" }, { status: 400 });
  }

  const partnerIds = await getPartnerIds(biz.id);
  if (!partnerIds.length) {
    return NextResponse.json({ error: "No active partners" }, { status: 400 });
  }

  // Credits check
  const credits = await getCredits(biz.id);
  const totalUsed = credits.free_used + credits.paid_used;
  const isPaid = credits.free_used >= FREE_BROADCASTS_PER_MONTH;
  const additionalFeeCents = isPaid ? ADDITIONAL_BROADCAST_FEE_CENTS : 0;

  // All opted-in customers from partner businesses with phone + text count
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, timezone, business_id")
    .in("business_id", partnerIds)
    .not("phone", "is", null)
    .eq("sms_marketing_consent", true);

  if (!customers?.length) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0, total: 0 });
  }

  const customerIds = customers.map((c) => c.id);

  // Get text counts for this month
  const { data: logs } = await supabaseAdmin
    .from("network_broadcast_log")
    .select("customer_id")
    .in("customer_id", customerIds)
    .eq("status", "sent")
    .gte("created_at", monthStart());

  const countMap = new Map<string, number>();
  for (const c of customers) countMap.set(c.id, 0);
  for (const log of logs ?? []) {
    countMap.set(log.customer_id, (countMap.get(log.customer_id) ?? 0) + 1);
  }

  // Filter to only customers in selected groups
  const selectedSet = new Set(selectedGroups);
  const eligible = customers.filter((c) => {
    const count = countMap.get(c.id) ?? 0;
    // If no groups selected, send to everyone under the soft cap (0–3 texts)
    if (selectedSet.size === 0) return count < SOFT_CAP;
    return selectedSet.has(count);
  });

  if (!eligible.length) {
    return NextResponse.json({ error: "No eligible customers in selected groups" }, { status: 400 });
  }

  // Build SMS body from template
  const templateBody = TEMPLATES[templateKey] ?? TEMPLATES.limited_offer;
  const baseMessage = templateBody
    .replace("{bizName}", biz.name)
    .replace("{offer}", offerText.trim());

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";

  // Create broadcast record
  const { data: broadcast } = await supabaseAdmin
    .from("network_broadcasts")
    .insert({
      sending_business_id: biz.id,
      message: baseMessage,
      template_key: templateKey,
      offer_text: offerText.trim(),
      offer_discount_cents: offerDiscountCents,
      additional_fee_cents: additionalFeeCents,
    })
    .select("id")
    .single();

  if (!broadcast) {
    return NextResponse.json({ error: "Failed to create broadcast record" }, { status: 500 });
  }

  const { client: twilioClient, mode } = getTwilio();
  const routing = getRouting(mode);

  let sent = 0, failed = 0, skipped = 0;
  const logRows: object[] = [];

  for (const customer of eligible) {
    if (!customer.phone) { failed++; continue; }

    if (isQuietHours(customer.timezone)) {
      logRows.push({
        broadcast_id: broadcast.id,
        sending_business_id: biz.id,
        partner_business_id: customer.business_id,
        customer_id: customer.id,
        status: "skipped",
        texts_this_month: countMap.get(customer.id) ?? 0,
        auto_discount_cents: 0,
      });
      skipped++;
      continue;
    }

    const textsThisMonth = countMap.get(customer.id) ?? 0;
    const autoDiscountCents = Math.max(0, (textsThisMonth + 1 - SOFT_CAP) * DISCOUNT_PER_TEXT_OVER_CAP_CENTS);

    // Build personalized message
    let smsBody = `[Katoomy Network] ${baseMessage}\nBook: ${appUrl}/${biz.slug}`;
    if (autoDiscountCents > 0) {
      const discountDollars = autoDiscountCents / 100;
      smsBody += `\n+ $${discountDollars} network bonus discount applied at booking this month.`;
    }
    smsBody += `\nReply STOP to opt out`;

    // Normalize to E.164 (+1XXXXXXXXXX) so Twilio LIVE accepts it
    const digits = customer.phone.replace(/\D/g, "");
    const e164 = digits.startsWith("1") && digits.length === 11
      ? `+${digits}`
      : `+1${digits}`;

    try {
      await twilioClient.messages.create({ body: smsBody, ...routing, to: e164 });
      logRows.push({
        broadcast_id: broadcast.id,
        sending_business_id: biz.id,
        partner_business_id: customer.business_id,
        customer_id: customer.id,
        status: "sent",
        texts_this_month: textsThisMonth,
        auto_discount_cents: autoDiscountCents,
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
        texts_this_month: textsThisMonth,
        auto_discount_cents: 0,
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

  await bumpCredits(biz.id, isPaid);

  return NextResponse.json({
    sent,
    failed,
    skipped,
    total: eligible.length,
    additionalFeeCents,
    isPaid,
  });
}
