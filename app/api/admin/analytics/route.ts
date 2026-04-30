// GET /api/admin/analytics?period=week|2weeks|month|3months|6months
//   or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD for custom ranges
// Returns metrics for the selected period + the equivalent prior period for comparison.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Period = "week" | "2weeks" | "month" | "3months" | "6months" | "custom";

function periodDays(period: Period): number {
  return { week: 7, "2weeks": 14, month: 30, "3months": 90, "6months": 180, custom: 30 }[period];
}

export async function GET(req: NextRequest) {
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
  const now = new Date();
  const params = req.nextUrl.searchParams;
  const period = (params.get("period") as Period) || "month";

  // Resolve date range — custom takes priority over period
  let currentStart: Date, currentEnd: Date;
  if (params.get("startDate") && params.get("endDate")) {
    currentStart = new Date(params.get("startDate")! + "T00:00:00");
    currentEnd = new Date(params.get("endDate")! + "T23:59:59");
  } else {
    const days = periodDays(period);
    currentEnd = new Date(now);
    currentStart = new Date(now); currentStart.setDate(now.getDate() - days); currentStart.setHours(0, 0, 0, 0);
  }

  // Previous period: same duration, shifted back
  const days = Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000);
  const previousEnd = new Date(currentStart);
  const previousStart = new Date(currentStart); previousStart.setDate(currentStart.getDate() - days);

  // Fetch all bookings covering both periods (2x the window)
  const { data: allBookingsRaw } = await supabaseAdmin
    .from("bookings")
    .select("id, start_ts, status, total_price_cents, deposit_amount_cents, payment_status, customer_id, service_id, services(name)")
    .eq("business_id", businessId)
    .gte("start_ts", previousStart.toISOString())
    .order("start_ts", { ascending: true });

  // For LTV/frequency/rebooking we need all-time data too
  const { data: allTimeBookingsRaw } = await supabaseAdmin
    .from("bookings")
    .select("id, start_ts, status, total_price_cents, deposit_amount_cents, payment_status, customer_id, service_id")
    .eq("business_id", businessId)
    .lt("start_ts", previousStart.toISOString())
    .order("start_ts", { ascending: true });

  const { data: customersRaw } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, created_at")
    .eq("business_id", businessId)
    .order("created_at");

  // Tips for bookings in both periods
  const windowIds = (allBookingsRaw || []).map(b => b.id);
  const tipsMap = new Map<string, number>();
  if (windowIds.length > 0) {
    const { data: tips } = await supabaseAdmin
      .from("tips")
      .select("booking_id, amount_cents")
      .in("booking_id", windowIds)
      .eq("status", "paid");
    for (const t of tips || []) {
      tipsMap.set(t.booking_id, (tipsMap.get(t.booking_id) || 0) + t.amount_cents);
    }
  }

  // Helpers
  const isPaid = (b: { status: string; payment_status: string }) =>
    (b.status === "completed" && ["paid", "cash_paid"].includes(b.payment_status)) ||
    ((b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid");

  const revenueOf = (b: { total_price_cents: number; deposit_amount_cents: number | null; payment_status: string; status: string }) => {
    const forfeited = (b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid";
    return forfeited ? (b.deposit_amount_cents || 0) : (b.total_price_cents || 0);
  };

  const windowBookings = allBookingsRaw || [];
  const allHistoric = [...windowBookings, ...(allTimeBookingsRaw || [])];
  const allCustomers = customersRaw || [];

  // Only customers with at least one completed/paid booking count toward LTV, rebooking, frequency
  const customersWithPayment = new Set(allHistoric.filter(isPaid).map(b => b.customer_id));

  const inPeriod = (b: { start_ts: string }, start: Date, end: Date) => {
    const d = new Date(b.start_ts);
    return d >= start && d < end;
  };

  const currentBookings = windowBookings.filter(b => inPeriod(b, currentStart, currentEnd));
  const previousBookings = windowBookings.filter(b => inPeriod(b, previousStart, previousEnd));

  // ── Period metrics ────────────────────────────────────────────────────────
  const periodMetrics = (bks: typeof windowBookings, start: Date) => {
    const nonCancelled = bks.filter(b => b.status !== "cancelled");
    const paid = bks.filter(isPaid);
    const rev = paid.reduce((s, b) => s + revenueOf(b) + (tipsMap.get(b.id) || 0), 0);
    const customerIds = [...new Set(nonCancelled.map(b => b.customer_id))];
    const newCusts = customerIds.filter(cid => {
      const c = allCustomers.find(c => c.id === cid);
      return c && new Date(c.created_at) >= start;
    }).length;
    const avgTicket = paid.length > 0 ? Math.round(paid.reduce((s, b) => s + revenueOf(b), 0) / paid.length) : 0;
    const lostBks = bks.filter(b => (b.status === "cancelled" || b.status === "no_show") && b.payment_status === "unpaid");
    return {
      bookings: nonCancelled.length,
      revenue: rev,
      newCustomers: newCusts,
      avgTicketCents: avgTicket,
      revenueLostCents: lostBks.reduce((s, b) => s + (b.total_price_cents || 0), 0),
      cancellations: lostBks.filter(b => b.status === "cancelled").length,
      noShows: lostBks.filter(b => b.status === "no_show").length,
    };
  };

  const current = periodMetrics(currentBookings, currentStart);
  const previous = periodMetrics(previousBookings, previousStart);

  // ── Booking trend (current vs previous, grouped by day or week) ───────────
  type TrendPoint = { label: string; current: number; previous: number };
  const trend: TrendPoint[] = [];

  if (days <= 30) {
    // Day by day
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(currentStart); dayStart.setDate(currentStart.getDate() + i);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
      const prevDayStart = new Date(previousStart); prevDayStart.setDate(previousStart.getDate() + i);
      const prevDayEnd = new Date(prevDayStart); prevDayEnd.setDate(prevDayStart.getDate() + 1);

      trend.push({
        label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        current: currentBookings.filter(b => inPeriod(b, dayStart, dayEnd) && b.status !== "cancelled").length,
        previous: previousBookings.filter(b => inPeriod(b, prevDayStart, prevDayEnd) && b.status !== "cancelled").length,
      });
    }
  } else {
    // Week by week
    const weeks = Math.ceil(days / 7);
    for (let i = 0; i < weeks; i++) {
      const wkStart = new Date(currentStart); wkStart.setDate(currentStart.getDate() + i * 7);
      const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 7);
      const prevWkStart = new Date(previousStart); prevWkStart.setDate(previousStart.getDate() + i * 7);
      const prevWkEnd = new Date(prevWkStart); prevWkEnd.setDate(prevWkStart.getDate() + 7);

      trend.push({
        label: `Wk ${i + 1}`,
        current: currentBookings.filter(b => inPeriod(b, wkStart, wkEnd) && b.status !== "cancelled").length,
        previous: previousBookings.filter(b => inPeriod(b, prevWkStart, prevWkEnd) && b.status !== "cancelled").length,
      });
    }
  }

  // ── Day of week + peak hours (current period) ─────────────────────────────
  const dowCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const b of currentBookings.filter(b => b.status !== "cancelled")) {
    dowCounts[new Date(b.start_ts).getDay()]++;
    hourCounts[new Date(b.start_ts).getHours()]++;
  }
  const bookingsByDayOfWeek = DAY_NAMES.map((name, i) => ({ name, count: dowCounts[i] }));
  const peakHours = hourCounts.map((count, hour) => ({
    hour: hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`,
    count,
  }));

  // ── Top services (current period) ─────────────────────────────────────────
  const serviceMap = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const b of currentBookings.filter(isPaid)) {
    const name = (Array.isArray(b.services)
      ? (b.services as { name: string }[])[0]?.name
      : (b.services as { name: string } | null)?.name) || "Unknown";
    const key = b.service_id || name;
    const ex = serviceMap.get(key) ?? { name, count: 0, revenueCents: 0 };
    ex.count++; ex.revenueCents += revenueOf(b);
    serviceMap.set(key, ex);
  }
  const topServices = Array.from(serviceMap.values()).sort((a, b) => b.count - a.count).slice(0, 8);

  // ── New vs returning (current period) ─────────────────────────────────────
  const currentCustomerIds = [...new Set(currentBookings.filter(b => b.status !== "cancelled").map(b => b.customer_id))];
  let newCount = 0, returningCount = 0;
  for (const cid of currentCustomerIds) {
    const c = allCustomers.find(c => c.id === cid);
    if (!c) continue;
    if (new Date(c.created_at) >= currentStart) newCount++; else returningCount++;
  }

  // ── All-time metrics (LTV, frequency, rebooking) ──────────────────────────
  const allPaid = allHistoric.filter(isPaid);
  const customerSpend = new Map<string, number>();
  for (const b of allPaid) {
    customerSpend.set(b.customer_id, (customerSpend.get(b.customer_id) || 0) + revenueOf(b) + (tipsMap.get(b.id) || 0));
  }
  const avgLTVCents = customerSpend.size > 0
    ? Math.round(Array.from(customerSpend.values()).reduce((s, v) => s + v, 0) / customerSpend.size) : 0;

  const avgTicketCents = allPaid.length > 0
    ? Math.round(allPaid.reduce((s, b) => s + revenueOf(b), 0) / allPaid.length) : 0;

  // Only count visits for customers who have at least one completed/paid booking
  const visitsByCustomer = new Map<string, Date[]>();
  for (const b of allHistoric.filter(b => b.status !== "cancelled" && b.status !== "no_show" && customersWithPayment.has(b.customer_id))) {
    const dates = visitsByCustomer.get(b.customer_id) || [];
    dates.push(new Date(b.start_ts));
    visitsByCustomer.set(b.customer_id, dates);
  }
  let totalGap = 0, gapCount = 0;
  for (const dates of visitsByCustomer.values()) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < dates.length; i++) {
      const g = (dates[i].getTime() - dates[i - 1].getTime()) / 86400000;
      if (g > 0 && g < 366) { totalGap += g; gapCount++; }
    }
  }
  const avgDaysBetweenVisits = gapCount > 0 ? Math.round(totalGap / gapCount) : null;

  const rebookingRate = visitsByCustomer.size > 0
    ? Math.round((Array.from(visitsByCustomer.values()).filter(d => d.length >= 2).length / visitsByCustomer.size) * 100) : 0;

  // ── Latest booking per customer (for at-risk) ─────────────────────────────
  const latestByCustomer = new Map<string, Date>();
  for (const b of allHistoric.filter(b => b.status !== "cancelled")) {
    const d = new Date(b.start_ts);
    const ex = latestByCustomer.get(b.customer_id);
    if (!ex || d > ex) latestByCustomer.set(b.customer_id, d);
  }
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
  const atRiskCustomers = allCustomers
    .filter(c => { const l = latestByCustomer.get(c.id); return l && l < thirtyDaysAgo; })
    .map(c => ({
      id: c.id, name: c.full_name || "Guest",
      lastVisit: latestByCustomer.get(c.id)!.toISOString(),
      daysSince: Math.floor((now.getTime() - latestByCustomer.get(c.id)!.getTime()) / 86400000),
    }))
    .sort((a, b) => a.daysSince - b.daysSince)
    .slice(0, 10);

  // ── Top customers (all time) ──────────────────────────────────────────────
  const topCustomers = allCustomers
    .filter(c => (customerSpend.get(c.id) || 0) > 0)
    .map(c => ({ id: c.id, name: c.full_name || "Guest", spentCents: customerSpend.get(c.id) || 0 }))
    .sort((a, b) => b.spentCents - a.spentCents)
    .slice(0, 8);

  // ── Smart alerts ──────────────────────────────────────────────────────────
  const alerts: { type: "warning" | "info" | "success"; message: string }[] = [];

  const revDiff = previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : null;
  if (revDiff !== null && revDiff <= -20)
    alerts.push({ type: "warning", message: `Revenue is down ${Math.abs(revDiff).toFixed(0)}% vs the previous period` });
  else if (revDiff !== null && revDiff >= 20)
    alerts.push({ type: "success", message: `Revenue is up ${revDiff.toFixed(0)}% vs the previous period` });

  if (current.revenueLostCents > 0)
    alerts.push({ type: "warning", message: `$${(current.revenueLostCents / 100).toFixed(0)} in missed revenue from cancellations and no-shows this period` });

  const topCustomerIds = new Set(topCustomers.map(c => c.id));
  const atRiskHighValue = atRiskCustomers.filter(c => topCustomerIds.has(c.id));
  if (atRiskHighValue.length > 0)
    alerts.push({ type: "warning", message: `${atRiskHighValue.length} of your top-spending customers haven't returned in 30+ days` });

  const activeDays = bookingsByDayOfWeek.filter(d => d.count > 0);
  if (activeDays.length > 1) {
    const slowest = activeDays.reduce((min, d) => d.count < min.count ? d : min);
    const busiest = activeDays.reduce((max, d) => d.count > max.count ? d : max);
    if (busiest.count > slowest.count * 2)
      alerts.push({ type: "info", message: `${slowest.name} is your slowest day -- consider a promotion to fill those slots` });
  }

  if (rebookingRate > 0 && rebookingRate < 40)
    alerts.push({ type: "info", message: `Only ${rebookingRate}% of customers have rebooked -- follow-up reminders could help` });
  else if (rebookingRate >= 70)
    alerts.push({ type: "success", message: `${rebookingRate}% rebooking rate -- your customers keep coming back!` });

  return NextResponse.json({
    period,
    currentPeriodLabel: `${currentStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${currentEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    previousPeriodLabel: `${previousStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${previousEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    current,
    previous,
    trend,
    bookingsByDayOfWeek,
    peakHours,
    topServices,
    newVsReturning: { newCount, returningCount, total: currentCustomerIds.length },
    atRiskCustomers,
    topCustomers,
    avgLTVCents,
    avgTicketCents,
    avgDaysBetweenVisits,
    rebookingRate,
    alerts,
    totalCustomers: customersWithPayment.size,
  });
}
