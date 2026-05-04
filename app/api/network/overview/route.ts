// GET /api/network/overview?businessId=
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const [{ data: sent }, { data: received }, { data: credits }] = await Promise.all([
    supabaseAdmin.from("network_referrals")
      .select("id, status, reward_cents")
      .eq("referring_business_id", businessId),
    supabaseAdmin.from("network_referrals")
      .select("id, status, discount_applied_cents")
      .eq("receiving_business_id", businessId),
    supabaseAdmin.from("network_credits")
      .select("amount_cents").eq("business_id", businessId),
  ]);

  const sentCount = sent?.length ?? 0;
  const receivedCount = received?.length ?? 0;
  const referralEarningsCents = (sent ?? []).reduce((s, r) => s + (r.reward_cents ?? 0), 0);
  const totalCreditsCents = (credits ?? []).reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const completedReceived = (received ?? []).filter((r) => r.status !== "pending").length;

  return NextResponse.json({
    customers_sent: sentCount,
    customers_received: receivedCount,
    net_gain: receivedCount - sentCount,
    referral_earnings_cents: referralEarningsCents,
    total_credits_cents: totalCreditsCents,
    completed_received: completedReceived,
  });
}
