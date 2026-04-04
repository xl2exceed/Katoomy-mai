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
    .select("id, timezone")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const businessTimezone = (business as { id: string; timezone?: string }).timezone || "America/New_York";

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
      "and(status.eq.custom,payment_status.eq.custom_paid)," +
      "and(status.in.(cancelled,no_show),payment_status.eq.deposit_paid)"
    )
    .order("start_ts", { ascending: false });

  if (startDate) query = query.gte("start_ts", startDate.toISOString());

  const { data: bookings, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookingIds = (bookings || []).map((b) => b.id);
  const tipsMap = new Map<string, number>();

  // Include ALL ledger entries — both standalone custom payments (booking_id IS NULL)
  // and custom payments linked to a booking (booking_id IS NOT NULL, i.e. custom-status bookings)
  let customPaymentsQuery = supabaseAdmin
    .from("alternative_payment_ledger")
    .select("id, appointment_ts, service_amount_cents, tip_cents, service_name, customer_name, payment_method, marked_paid_by, booking_id")
    .eq("business_id", business.id);
  if (startDate) customPaymentsQuery = customPaymentsQuery.gte("appointment_ts", startDate.toISOString());

  const [tipsResult, ledgerTipsResult, { data: customPayments }] = await Promise.all([
    bookingIds.length > 0
      ? supabaseAdmin.from("tips").select("booking_id, amount_cents").in("booking_id", bookingIds).eq("status", "paid")
      : Promise.resolve({ data: [] as { booking_id: string; amount_cents: number }[] }),
    bookingIds.length > 0
      ? supabaseAdmin.from("alternative_payment_ledger").select("booking_id, tip_cents").in("booking_id", bookingIds).gt("tip_cents", 0)
      : Promise.resolve({ data: [] as { booking_id: string | null; tip_cents: number }[] }),
    customPaymentsQuery.limit(500),
  ]);

  for (const t of (tipsResult.data || [])) {
    tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.amount_cents);
  }
  for (const t of (ledgerTipsResult.data || [])) {
    if (t.booking_id) {
      tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.tip_cents);
    }
  }

  // Look up staff names for custom payments attributed to staff
  const customStaffIds = [...new Set((customPayments || []).map((p) => p.marked_paid_by).filter(Boolean))];
  const customStaffNameMap = new Map<string, string>();
  if (customStaffIds.length > 0) {
    const { data: staffRows } = await supabaseAdmin.from("staff").select("id, full_name").in("id", customStaffIds);
    for (const s of staffRows || []) customStaffNameMap.set(s.id, s.full_name ?? "Staff");
  }

  // Helper: resolve Supabase join (may be array or object)
  function pick<T>(val: T[] | T | null, key: keyof NonNullable<T>): string {
    if (!val) return "";
    const obj = Array.isArray(val) ? val[0] : val;
    return (obj as Record<string, unknown>)?.[key as string] as string ?? "";
  }

  // Build a map of booking_id -> ledger entry for custom-paid bookings so we use the actual charged amount
  const customLedgerByBookingId = new Map<string, { service_amount_cents: number; tip_cents: number }>();
  for (const p of (customPayments || [])) {
    if (p.booking_id) customLedgerByBookingId.set(p.booking_id, p);
  }

  const bookingTransactions = (bookings || []).map((b) => {
    const isForfeited = (b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid";
    const isCustomPaid = b.status === "custom" && b.payment_status === "custom_paid";
    // For custom-paid bookings, use the ledger amount (the actual charged amount, not the service list price)
    const ledgerEntry = isCustomPaid ? customLedgerByBookingId.get(b.id) : undefined;
    const serviceAmountCents = isForfeited
      ? (b.deposit_amount_cents || 0)
      : isCustomPaid
        ? (ledgerEntry?.service_amount_cents ?? b.total_price_cents ?? 0)
        : (b.total_price_cents || 0);
    const tipAmountCents = isForfeited ? 0 : isCustomPaid ? (ledgerEntry?.tip_cents ?? 0) : (tipsMap.get(b.id) || 0);
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
      isCustom: isCustomPaid,
    };
  });

  // Only include ledger entries that are NOT linked to a booking (standalone custom payments)
  // Booking-linked custom payments are already counted via bookingTransactions above
  const customTransactions = (customPayments || []).filter((p) => !p.booking_id).map((p) => ({
    id: p.id,
    date: p.appointment_ts,
    staffId: p.marked_paid_by ?? null,
    staffName: p.marked_paid_by ? (customStaffNameMap.get(p.marked_paid_by) || "Staff") : "Admin",
    customerName: p.customer_name ?? "—",
    serviceName: p.service_name ?? "Custom Payment",
    serviceAmountCents: p.service_amount_cents,
    tipAmountCents: p.tip_cents ?? 0,
    totalCents: p.service_amount_cents + (p.tip_cents ?? 0),
    forfeited: false,
  }));

  const transactions = [...bookingTransactions, ...customTransactions];

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
    timezone: businessTimezone,
  });
}
