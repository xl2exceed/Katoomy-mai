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

  const [{ data: offerSent }, { data: offerReceived }, { data: credits }, { data: directSent }, { data: directReceived }] = await Promise.all([
    supabaseAdmin.from("network_referrals")
      .select("id, status, reward_cents")
      .eq("referring_business_id", businessId),
    supabaseAdmin.from("network_referrals")
      .select("id, status, discount_applied_cents")
      .eq("receiving_business_id", businessId),
    supabaseAdmin.from("network_credits")
      .select("amount_cents").eq("business_id", businessId),
    supabaseAdmin.from("network_direct_referrals")
      .select("id, status")
      .eq("sending_business_id", businessId),
    supabaseAdmin.from("network_direct_referrals")
      .select("id, status")
      .eq("receiving_business_id", businessId),
  ]);

  const offerSentCount = offerSent?.length ?? 0;
  const offerReceivedCount = offerReceived?.length ?? 0;
  const directSentCount = directSent?.length ?? 0;
  const directReceivedCount = directReceived?.length ?? 0;
  const referralEarningsCents = (offerSent ?? []).reduce((s, r) => s + (r.reward_cents ?? 0), 0);
  const totalCreditsCents = (credits ?? []).reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const completedReceived = (offerReceived ?? []).filter((r) => r.status !== "pending").length;

  return NextResponse.json({
    customers_sent: offerSentCount + directSentCount,
    customers_received: offerReceivedCount + directReceivedCount,
    offer_link_received: offerReceivedCount,
    direct_received: directReceivedCount,
    referral_earnings_cents: referralEarningsCents,
    total_credits_cents: totalCreditsCents,
    completed_received: completedReceived,
  });
}
