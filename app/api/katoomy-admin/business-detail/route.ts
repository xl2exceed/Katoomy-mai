// GET /api/katoomy-admin/business-detail?businessId=xxx
// Returns comprehensive metrics for a single business.
// Requires X-Katoomy-Email header.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function authorize(req: NextRequest) {
  const email = req.headers.get("x-katoomy-email");
  if (!email) return false;
  const { data } = await supabaseAdmin
    .from("katoomy_admins")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single();
  return !!data;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
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

  // Fetch all data in parallel
  const [
    bizResult,
    bookingsResult,
    customersResult,
    membersResult,
    staffResult,
    disputesResult,
    smsResult,
    reportsResult,
    loyaltyResult,
  ] = await Promise.all([
    // Business profile
    supabaseAdmin
      .from("businesses")
      .select("id, name, slug, created_at, features, primary_color")
      .eq("id", businessId)
      .single(),

    // All bookings
    supabaseAdmin
      .from("bookings")
      .select("id, created_at, start_ts, status, payment_status")
      .eq("business_id", businessId),

    // All customers
    supabaseAdmin
      .from("customers")
      .select("id, created_at, full_name, phone")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10),

    // Active members
    supabaseAdmin
      .from("member_subscriptions")
      .select("id, created_at, current_period_end, customers(full_name, phone), membership_plans(name, price_cents)")
      .eq("business_id", businessId)
      .eq("status", "active"),

    // Staff
    supabaseAdmin
      .from("staff")
      .select("id, full_name, email, role, created_at")
      .eq("business_id", businessId),

    // Payment disputes / refunds
    supabaseAdmin
      .from("booking_payment_reports")
      .select("id, created_at, total_amount_cents, refund_amount_cents, payment_method, dispute_status")
      .eq("business_id", businessId)
      .not("dispute_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),

    // SMS count
    supabaseAdmin
      .from("sms_messages")
      .select("id, created_at, direction")
      .eq("business_id", businessId),

    // Payment reports for revenue
    supabaseAdmin
      .from("booking_payment_reports")
      .select("id, created_at, total_amount_cents, payment_method")
      .eq("business_id", businessId),

    // Loyalty settings
    supabaseAdmin
      .from("loyalty_settings")
      .select("enabled, visits_required, reward_description")
      .eq("business_id", businessId)
      .single(),
  ]);

  const biz = bizResult.data;
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const bookings = bookingsResult.data || [];
  const reports = reportsResult.data || [];
  const smsMessages = smsResult.data || [];

  // Booking breakdowns
  const bookingsByPeriod = (start: string) =>
    bookings.filter((b) => b.start_ts >= start);

  const revenueByPeriod = (start: string) =>
    reports
      .filter((r) => r.created_at >= start)
      .reduce((sum, r) => sum + (r.total_amount_cents || 0), 0) / 100;

  const countByStatus = (status: string) =>
    bookings.filter((b) => b.status === status).length;

  const detail = {
    business: biz,
    stats: {
      totalBookings: bookings.length,
      completedBookings: countByStatus("completed"),
      noShows: countByStatus("no_show"),
      cancelledBookings: countByStatus("cancelled"),
      allTimeRevenue: reports.reduce((s, r) => s + (r.total_amount_cents || 0), 0) / 100,
      totalCustomers: (await supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId)).count || 0,
    },
    periods: {
      today: {
        bookings: bookingsByPeriod(startOfToday).length,
        revenue: revenueByPeriod(startOfToday),
      },
      week: {
        bookings: bookingsByPeriod(startOfWeek).length,
        revenue: revenueByPeriod(startOfWeek),
      },
      month: {
        bookings: bookingsByPeriod(startOfMonth).length,
        revenue: revenueByPeriod(startOfMonth),
      },
      allTime: {
        bookings: bookings.length,
        revenue: reports.reduce((s, r) => s + (r.total_amount_cents || 0), 0) / 100,
      },
    },
    members: membersResult.data || [],
    recentCustomers: customersResult.data || [],
    staff: staffResult.data || [],
    disputes: disputesResult.data || [],
    sms: {
      total: smsMessages.length,
      sent: smsMessages.filter((s) => s.direction === "outbound").length,
      received: smsMessages.filter((s) => s.direction === "inbound").length,
    },
    loyalty: loyaltyResult.data || null,
  };

  return NextResponse.json(detail);
}
