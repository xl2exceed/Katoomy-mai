// GET /api/katoomy-admin/business-detail?businessId=xxx
// Returns comprehensive metrics for a single business.

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

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    bizResult,
    bookingsResult,
    membersResult,
    staffResult,
    disputesResult,
    smsResult,
    reportsResult,
    loyaltyResult,
    pwaInstallsResult,
    aiCampaignsResult,
    availabilityResult,
    stripeConnectResult,
    referralsResult,
    depositResult,
    customerCountResult,
    recentCustomersResult,
    networkSettingsResult,
    networkPartnersResult,
    networkOffersResult,
    networkSentResult,
    networkReceivedResult,
    networkDirectSentResult,
    networkDirectReceivedResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id, name, slug, created_at, features, primary_color, subscription_plan, subscription_status, owner_name, owner_email, phone, timezone")
      .eq("id", businessId)
      .single(),

    supabaseAdmin
      .from("bookings")
      .select("id, created_at, start_ts, status, payment_status")
      .eq("business_id", businessId),

    supabaseAdmin
      .from("member_subscriptions")
      .select("id, created_at, current_period_end, customers(full_name, phone), membership_plans(name, price_cents)")
      .eq("business_id", businessId)
      .eq("status", "active"),

    supabaseAdmin
      .from("staff")
      .select("id, full_name, email, role, created_at")
      .eq("business_id", businessId),

    supabaseAdmin
      .from("booking_payment_reports")
      .select("id, created_at, total_amount_cents, payment_method, dispute_status")
      .eq("business_id", businessId)
      .not("dispute_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),

    supabaseAdmin
      .from("sms_messages")
      .select("id, direction")
      .eq("business_id", businessId),

    supabaseAdmin
      .from("booking_payment_reports")
      .select("id, created_at, total_amount_cents")
      .eq("business_id", businessId),

    // Fixed loyalty query with correct column names
    supabaseAdmin
      .from("loyalty_settings")
      .select("enabled, reward_type, reward_value, threshold_points, referral_enabled, earn_on_completion, earn_on_booking")
      .eq("business_id", businessId)
      .maybeSingle(),

    supabaseAdmin
      .from("pwa_installs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),

    supabaseAdmin
      .from("ai_marketing_settings")
      .select("winback_enabled, referral_enabled, appt_reminder_enabled, reengage_enabled, winback_30_enabled, winback_60_enabled, winback_90_enabled")
      .eq("business_id", businessId)
      .maybeSingle(),

    supabaseAdmin
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, days_open")
      .eq("business_id", businessId)
      .order("day_of_week", { ascending: true }),

    supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, created_at")
      .eq("business_id", businessId)
      .maybeSingle(),

    supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),

    supabaseAdmin
      .from("deposit_settings")
      .select("enabled, type, amount_cents, percent")
      .eq("business_id", businessId)
      .maybeSingle(),

    supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),

    supabaseAdmin
      .from("customers")
      .select("id, created_at, full_name, phone")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10),

    supabaseAdmin
      .from("network_settings")
      .select("enabled, referral_reward_cents")
      .eq("business_id", businessId)
      .maybeSingle(),

    supabaseAdmin
      .from("network_partners")
      .select("id", { count: "exact", head: true })
      .or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`)
      .eq("status", "active"),

    supabaseAdmin
      .from("network_offers")
      .select("id, title, offer_type, amount")
      .eq("business_id", businessId),

    supabaseAdmin
      .from("network_referrals")
      .select("id, status, reward_cents, network_offer_id")
      .eq("referring_business_id", businessId),

    supabaseAdmin
      .from("network_referrals")
      .select("id, status")
      .eq("receiving_business_id", businessId),

    supabaseAdmin
      .from("network_direct_referrals")
      .select("id", { count: "exact", head: true })
      .eq("sending_business_id", businessId),

    supabaseAdmin
      .from("network_direct_referrals")
      .select("id", { count: "exact", head: true })
      .eq("receiving_business_id", businessId),
  ]);

  const biz = bizResult.data;
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const bookings = bookingsResult.data || [];
  const reports = reportsResult.data || [];
  const smsMessages = smsResult.data || [];

  // Network stats
  const networkOfferSent = networkSentResult.data || [];
  const networkOfferReceived = networkReceivedResult.data || [];
  const networkOfferUsage = new Map<string, number>();
  networkOfferSent.forEach((r) => {
    if (r.network_offer_id) networkOfferUsage.set(r.network_offer_id, (networkOfferUsage.get(r.network_offer_id) || 0) + 1);
  });
  const networkOffers = (networkOffersResult.data || []).map((o) => ({
    ...o,
    usage_count: networkOfferUsage.get(o.id) || 0,
  }));
  const networkStats = {
    enabled: networkSettingsResult.data?.enabled ?? false,
    active_partners: networkPartnersResult.count ?? 0,
    customers_sent: networkOfferSent.length + (networkDirectSentResult.count ?? 0),
    customers_received: networkOfferReceived.length + (networkDirectReceivedResult.count ?? 0),
    offer_link_received: networkOfferReceived.length,
    direct_received: networkDirectReceivedResult.count ?? 0,
    referral_earnings_cents: networkOfferSent.reduce((s, r) => s + (r.reward_cents ?? 0), 0),
    completed_received: networkOfferReceived.filter((r) => r.status !== "pending").length,
    offers: networkOffers,
  };

  const bookingsByPeriod = (start: string) => bookings.filter((b) => b.start_ts >= start);
  const revenueByPeriod = (start: string) =>
    reports.filter((r) => r.created_at >= start).reduce((s, r) => s + (r.total_amount_cents || 0), 0) / 100;

  const countByStatus = (status: string) => bookings.filter((b) => b.status === status).length;

  return NextResponse.json({
    business: biz,
    stats: {
      totalBookings: bookings.length,
      completedBookings: countByStatus("completed"),
      noShows: countByStatus("no_show"),
      cancelledBookings: countByStatus("cancelled"),
      allTimeRevenue: reports.reduce((s, r) => s + (r.total_amount_cents || 0), 0) / 100,
      totalCustomers: customerCountResult.count || 0,
      appInstalls: pwaInstallsResult.count || 0,
      totalReferrals: referralsResult.count || 0,
    },
    periods: {
      today: { bookings: bookingsByPeriod(startOfToday).length, revenue: revenueByPeriod(startOfToday) },
      week: { bookings: bookingsByPeriod(startOfWeek).length, revenue: revenueByPeriod(startOfWeek) },
      month: { bookings: bookingsByPeriod(startOfMonth).length, revenue: revenueByPeriod(startOfMonth) },
      allTime: { bookings: bookings.length, revenue: reports.reduce((s, r) => s + (r.total_amount_cents || 0), 0) / 100 },
    },
    members: membersResult.data || [],
    recentCustomers: recentCustomersResult.data || [],
    staff: staffResult.data || [],
    disputes: disputesResult.data || [],
    sms: {
      total: smsMessages.length,
      sent: smsMessages.filter((s) => s.direction === "outbound").length,
      received: smsMessages.filter((s) => s.direction === "inbound").length,
    },
    loyalty: loyaltyResult.data || null,
    appInstalls: pwaInstallsResult.count || 0,
    automatedCampaigns: aiCampaignsResult.data || null,
    availability: availabilityResult.data || [],
    stripeConnect: stripeConnectResult.data || null,
    depositSettings: depositResult.data || null,
    network: networkStats,
  });
}
