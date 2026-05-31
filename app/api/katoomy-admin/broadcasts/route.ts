// GET /api/katoomy-admin/broadcasts?month=2026-05
// Returns broadcast activity, fees owed per business, and discount liability for Katoomy admin portal.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_TOKEN = process.env.KATOOMY_ADMIN_TOKEN || "katoomy-internal-2026";
function authorize(req: NextRequest) {
  return req.headers.get("x-katoomy-token") === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default to current month
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = req.nextUrl.searchParams.get("month") || defaultMonth;

  // Month boundaries
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1).toISOString();
  const monthEnd   = new Date(year, mon, 1).toISOString();

  // ── Broadcasts for this month ─────────────────────────────────────────────
  const { data: broadcasts } = await supabaseAdmin
    .from("network_broadcasts")
    .select("id, sending_business_id, template_key, offer_text, offer_discount_cents, total_sent, total_failed, total_skipped, additional_fee_cents, created_at, businesses(name, slug)")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd)
    .order("created_at", { ascending: false });

  // ── Discount liability per broadcast (sum auto_discount_cents from sent logs) ─
  const broadcastIds = (broadcasts ?? []).map((b) => b.id);
  let discountByBroadcast: Record<string, number> = {};

  if (broadcastIds.length > 0) {
    const { data: discountRows } = await supabaseAdmin
      .from("network_broadcast_log")
      .select("broadcast_id, auto_discount_cents")
      .in("broadcast_id", broadcastIds)
      .eq("status", "sent");

    for (const row of discountRows ?? []) {
      discountByBroadcast[row.broadcast_id] =
        (discountByBroadcast[row.broadcast_id] ?? 0) + (row.auto_discount_cents ?? 0);
    }
  }

  // ── Redeemed discounts this month ─────────────────────────────────────────
  let redeemedByBroadcast: Record<string, number> = {};
  if (broadcastIds.length > 0) {
    const { data: redeemedRows } = await supabaseAdmin
      .from("network_broadcast_log")
      .select("broadcast_id, auto_discount_cents")
      .in("broadcast_id", broadcastIds)
      .not("redeemed_at", "is", null);

    for (const row of redeemedRows ?? []) {
      redeemedByBroadcast[row.broadcast_id] =
        (redeemedByBroadcast[row.broadcast_id] ?? 0) + (row.auto_discount_cents ?? 0);
    }
  }

  // ── Build broadcast rows ──────────────────────────────────────────────────
  const broadcastRows = (broadcasts ?? []).map((b) => {
    const biz = Array.isArray(b.businesses) ? b.businesses[0] : b.businesses;
    return {
      id: b.id,
      business_name: biz?.name ?? "Unknown",
      business_slug: biz?.slug ?? "",
      template_key: b.template_key,
      offer_text: b.offer_text,
      offer_discount_cents: b.offer_discount_cents ?? 0,
      total_sent: b.total_sent,
      total_failed: b.total_failed,
      total_skipped: b.total_skipped,
      additional_fee_cents: b.additional_fee_cents ?? 0,
      discount_committed_cents: discountByBroadcast[b.id] ?? 0,
      discount_redeemed_cents: redeemedByBroadcast[b.id] ?? 0,
      created_at: b.created_at,
    };
  });

  // ── Fees owed per business this month ─────────────────────────────────────
  const { data: credits } = await supabaseAdmin
    .from("network_broadcast_credits")
    .select("business_id, free_used, paid_used, businesses(name, slug)")
    .eq("month_year", month);

  const feesByBusiness = (credits ?? []).map((c) => {
    const biz = Array.isArray(c.businesses) ? c.businesses[0] : c.businesses;
    return {
      business_id: c.business_id,
      business_name: biz?.name ?? "Unknown",
      business_slug: biz?.slug ?? "",
      free_used: c.free_used,
      paid_used: c.paid_used,
      fees_owed_cents: c.paid_used * 500,
    };
  }).sort((a, b) => b.fees_owed_cents - a.fees_owed_cents);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalSent              = broadcastRows.reduce((s, b) => s + b.total_sent, 0);
  const totalFeesCents         = broadcastRows.reduce((s, b) => s + b.additional_fee_cents, 0);
  const totalDiscountCommitted = broadcastRows.reduce((s, b) => s + b.discount_committed_cents, 0);
  const totalDiscountRedeemed  = broadcastRows.reduce((s, b) => s + b.discount_redeemed_cents, 0);

  return NextResponse.json({
    month,
    summary: {
      totalBroadcasts: broadcastRows.length,
      totalSent,
      totalFeesCents,
      totalDiscountCommittedCents: totalDiscountCommitted,
      totalDiscountRedeemedCents:  totalDiscountRedeemed,
    },
    broadcasts: broadcastRows,
    feesByBusiness,
  });
}
