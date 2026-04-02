// GET /api/admin/revenue?period=today|week|month|all
// Business-wide revenue summary broken down by staff member.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "week";

  const now = new Date();
  let startDate: Date | null = null;
  if (period === "today") {
    startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    startDate = new Date(now); startDate.setDate(now.getDate() - 7);
  } else if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  let query = supabaseAdmin
    .from("bookings")
    .select("id, start_ts, total_price_cents, deposit_amount_cents, payment_status, status, staff_id, customers(full_name), services(name), staff(full_name)")
    .eq("business_id", business.id)
    .or(
      "and(status.eq.completed,payment_status.in.(paid,cash_paid))," +
      "and(status.in.(cancelled,no_show),payment_status.eq.deposit_paid)"
    )
    .order("start_ts", { ascending: false });

  if (startDate) query = query.gte("start_ts", startDate.toISOString());

  const { data: bookings, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookingIds = (bookings || []).map((b) => b.id);
  const tipsMap = new Map<string, number>();

  if (bookingIds.length > 0) {
    const [{ data: tips }, { data: ledgerTips }] = await Promise.all([
      supabaseAdmin
        .from("tips")
        .select("booking_id, amount_cents")
        .in("booking_id", bookingIds)
        .eq("status", "paid"),
      supabaseAdmin
        .from("alternative_payment_ledger")
        .select("booking_id, tip_cents")
        .in("booking_id", bookingIds)
        .gt("tip_cents", 0),
    ]);
    for (const t of tips || []) {
      tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.amount_cents);
    }
    for (const t of ledgerTips || []) {
      if (t.booking_id) {
        tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.tip_cents);
      }
    }
  }

  // Helper: resolve Supabase join (may be array or object)
  function pick<T>(val: T[] | T | null, key: keyof NonNullable<T>): string {
    if (!val) return "";
    const obj = Array.isArray(val) ? val[0] : val;
    return (obj as Record<string, unknown>)?.[key as string] as string ?? "";
  }

  const transactions = (bookings || []).map((b) => {
    // For cancelled/no-show with deposit: only the deposit was kept, not the full price
    const isForfeited = (b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid";
    const serviceAmountCents = isForfeited ? (b.deposit_amount_cents || 0) : (b.total_price_cents || 0);
    const tipAmountCents = isForfeited ? 0 : (tipsMap.get(b.id) || 0);
    return {
      id: b.id,
      date: b.start_ts,
      staffId: b.staff_id as string | null,
      staffName: pick(b.staff as { full_name: string }[] | { full_name: string } | null, "full_name") || "No Staff",
      customerName: pick(b.customers as { full_name: string }[] | { full_name: string } | null, "full_name") || "Guest",
      serviceName: pick(b.services as { name: string }[] | { name: string } | null, "name"),
      serviceAmountCents,
      tipAmountCents,
      totalCents: serviceAmountCents + tipAmountCents,
      forfeited: isForfeited,
    };
  });

  // Build per-staff breakdown
  const staffMap = new Map<string, { staffName: string; serviceRevenueCents: number; tipsCents: number; count: number }>();
  for (const t of transactions) {
    const key = t.staffId ?? "unassigned";
    const existing = staffMap.get(key) ?? { staffName: t.staffName, serviceRevenueCents: 0, tipsCents: 0, count: 0 };
    existing.serviceRevenueCents += t.serviceAmountCents;
    existing.tipsCents += t.tipAmountCents;
    existing.count += 1;
    staffMap.set(key, existing);
  }

  const staffBreakdown = Array.from(staffMap.entries())
    .map(([staffId, data]) => ({ staffId, ...data, totalCents: data.serviceRevenueCents + data.tipsCents }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const serviceRevenueCents = transactions.reduce((s, t) => s + t.serviceAmountCents, 0);
  const tipsCents = transactions.reduce((s, t) => s + t.tipAmountCents, 0);

  // ── Membership subscription revenue ──────────────────────────────────────
  let membershipQuery = supabaseAdmin
    .from("member_subscriptions")
    .select("id, created_at, plan_id, customer_id, membership_plans(name, price_cents), customers(full_name)")
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (startDate) membershipQuery = membershipQuery.gte("created_at", startDate.toISOString());

  const { data: memberships } = await membershipQuery.limit(500);

  const membershipTransactions = (memberships || []).map((m) => {
    const plan = Array.isArray(m.membership_plans) ? m.membership_plans[0] : m.membership_plans;
    const customer = Array.isArray(m.customers) ? m.customers[0] : m.customers;
    return {
      id: m.id,
      date: m.created_at,
      customerName: (customer as { full_name: string } | null)?.full_name ?? "Unknown",
      planName: (plan as { name: string; price_cents: number } | null)?.name ?? "Membership",
      amountCents: (plan as { name: string; price_cents: number } | null)?.price_cents ?? 0,
    };
  });

  const membershipRevenueCents = membershipTransactions.reduce((s, m) => s + m.amountCents, 0);

  return NextResponse.json({
    serviceRevenueCents,
    tipsCents,
    membershipRevenueCents,
    totalRevenueCents: serviceRevenueCents + tipsCents + membershipRevenueCents,
    staffBreakdown,
    transactions,
    membershipTransactions,
  });
}
