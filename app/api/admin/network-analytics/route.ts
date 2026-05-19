// GET /api/admin/network-analytics
// Returns network referral analytics for the authenticated business owner.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const businessId = business.id;

  const [
    { data: settings },
    { data: offers },
    { data: partners },
    { data: sent },
    { data: received },
    { data: credits },
    { data: directSent },
    { data: directReceived },
  ] = await Promise.all([
    supabaseAdmin.from("network_settings").select("enabled, referral_reward_cents").eq("business_id", businessId).maybeSingle(),
    supabaseAdmin.from("network_offers").select("id, title, offer_type, amount, created_at").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabaseAdmin.from("network_partners").select("id").eq("business_id", businessId).eq("status", "active"),
    supabaseAdmin.from("network_referrals").select("id, status, reward_cents, created_at, network_offer_id").eq("referring_business_id", businessId),
    supabaseAdmin.from("network_referrals").select("id, status, discount_applied_cents, created_at, network_offer_id").eq("receiving_business_id", businessId),
    supabaseAdmin.from("network_credits").select("amount_cents").eq("business_id", businessId),
    supabaseAdmin.from("network_direct_referrals").select("id, status, created_at").eq("sending_business_id", businessId),
    supabaseAdmin.from("network_direct_referrals").select("id, status, created_at").eq("receiving_business_id", businessId),
  ]);

  // Per-offer usage stats — count from the received side: offers belong to this business,
  // so usage = network_referrals where receiving_business_id = this business and offer matches
  const offerUsage = new Map<string, number>();
  (received ?? []).forEach((r) => {
    if (r.network_offer_id) offerUsage.set(r.network_offer_id, (offerUsage.get(r.network_offer_id) || 0) + 1);
  });
  const offersWithStats = (offers ?? []).map((o) => ({
    ...o,
    usage_count: offerUsage.get(o.id) || 0,
  }));

  const offerSentCount = sent?.length ?? 0;
  const directSentCount = directSent?.length ?? 0;
  const offerReceivedCount = received?.length ?? 0;
  const directReceivedCount = directReceived?.length ?? 0;
  const totalSent = offerSentCount + directSentCount;
  const totalReceived = offerReceivedCount + directReceivedCount;

  const referralEarningsCents = (sent ?? []).reduce((s, r) => s + (r.reward_cents ?? 0), 0);
  const totalCreditsCents = (credits ?? []).reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const completedReceived = (received ?? []).filter((r) => r.status !== "pending").length;

  type ActivityItem = { id: string; direction: "sent" | "received"; type: "direct" | "offer"; status: string; created_at: string };
  const activity: ActivityItem[] = [];
  (sent ?? []).forEach((r) => activity.push({ id: r.id, direction: "sent", type: "offer", status: r.status, created_at: r.created_at }));
  (received ?? []).forEach((r) => activity.push({ id: r.id, direction: "received", type: "offer", status: r.status, created_at: r.created_at }));
  (directSent ?? []).forEach((r) => activity.push({ id: r.id, direction: "sent", type: "direct", status: r.status, created_at: r.created_at }));
  (directReceived ?? []).forEach((r) => activity.push({ id: r.id, direction: "received", type: "direct", status: r.status, created_at: r.created_at }));
  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    enabled: settings?.enabled ?? false,
    activePartners: partners?.length ?? 0,
    customers_sent: totalSent,
    customers_received: totalReceived,
    net_gain: totalReceived - totalSent,
    referral_earnings_cents: referralEarningsCents,
    total_credits_cents: totalCreditsCents,
    completed_received: completedReceived,
    offers: offersWithStats,
    recentActivity: activity.slice(0, 20),
  });
}
