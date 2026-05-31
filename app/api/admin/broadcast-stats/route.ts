// GET /api/admin/broadcast-stats
// Returns the authenticated business's own network broadcast stats for the current month.
// Used by the admin analytics page.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // This month's broadcasts sent by this business
  const { data: broadcasts } = await supabaseAdmin
    .from("network_broadcasts")
    .select("id, offer_text, template_key, total_sent, total_failed, total_skipped, additional_fee_cents, created_at")
    .eq("sending_business_id", biz.id)
    .gte("created_at", monthStart)
    .order("created_at", { ascending: false });

  const broadcastIds = (broadcasts ?? []).map((b) => b.id);

  // Discount committed and redeemed this month
  let discountCommittedCents = 0;
  let discountRedeemedCents  = 0;

  if (broadcastIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from("network_broadcast_log")
      .select("auto_discount_cents, redeemed_at")
      .in("broadcast_id", broadcastIds)
      .eq("status", "sent");

    for (const log of logs ?? []) {
      discountCommittedCents += log.auto_discount_cents ?? 0;
      if (log.redeemed_at) discountRedeemedCents += log.auto_discount_cents ?? 0;
    }
  }

  // Credits this month
  const { data: credits } = await supabaseAdmin
    .from("network_broadcast_credits")
    .select("free_used, paid_used")
    .eq("business_id", biz.id)
    .eq("month_year", month)
    .maybeSingle();

  const totalSent     = (broadcasts ?? []).reduce((s, b) => s + (b.total_sent ?? 0), 0);
  const totalFeesCents = (broadcasts ?? []).reduce((s, b) => s + (b.additional_fee_cents ?? 0), 0);

  return NextResponse.json({
    month,
    summary: {
      totalBroadcasts:             (broadcasts ?? []).length,
      totalSent,
      totalFeesCents,
      discountCommittedCents,
      discountRedeemedCents,
      freeUsed:  credits?.free_used  ?? 0,
      paidUsed:  credits?.paid_used  ?? 0,
      freeRemaining: Math.max(0, 1 - (credits?.free_used ?? 0)),
    },
    broadcasts: (broadcasts ?? []).map((b) => ({
      id:                   b.id,
      offer_text:           b.offer_text,
      template_key:         b.template_key,
      total_sent:           b.total_sent,
      total_failed:         b.total_failed,
      total_skipped:        b.total_skipped,
      additional_fee_cents: b.additional_fee_cents,
      created_at:           b.created_at,
    })),
  });
}
