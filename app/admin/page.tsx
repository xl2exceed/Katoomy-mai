// app/admin/page.tsx — Business Command Center
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatTime(ts: string, tz: string) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

function tzMidnight(tz: string, offsetDays = 0): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === "hour")!.value) % 24;
  const m = parseInt(parts.find(p => p.type === "minute")!.value);
  const s = parseInt(parts.find(p => p.type === "second")!.value);
  const midnight = new Date(now.getTime() - (h * 3600 + m * 60 + s) * 1000 - now.getMilliseconds());
  midnight.setUTCDate(midnight.getUTCDate() + offsetDays);
  return midnight;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Supabase returns joins as arrays or objects depending on cardinality — handle both
function pick(val: unknown, key: string): string {
  if (!val) return "";
  const obj = Array.isArray(val) ? val[0] : val;
  return (obj as Record<string, string>)?.[key] ?? "";
}

export default async function AdminOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug, timezone")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) redirect("/admin/branding");

  const now = new Date();
  const tz = business.timezone ?? "America/New_York";
  const todayStart = tzMidnight(tz);
  const todayEnd = tzMidnight(tz, 1);
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { data: todayBookings },
    { data: nextUpcoming },
    { count: unpaidCount },
    { data: thisWeekPaid },
    { data: lastWeekPaid },
    { count: thisWeekCompleted },
    { count: newCustomers },
    { count: totalCustomers },
    { count: appInstalls },
    { data: recentBookings },
    { count: activeMembers },
  ] = await Promise.all([
    // Today's bookings
    supabaseAdmin
      .from("bookings")
      .select("id, start_ts, status, total_price_cents, customers(full_name, phone), services(name)")
      .eq("business_id", business.id)
      .gte("start_ts", todayStart.toISOString())
      .lte("start_ts", todayEnd.toISOString())
      .neq("status", "cancelled")
      .order("start_ts", { ascending: true }),

    // Next upcoming booking from now
    supabaseAdmin
      .from("bookings")
      .select("id, start_ts, customers(full_name, phone), services(name)")
      .eq("business_id", business.id)
      .gte("start_ts", now.toISOString())
      .in("status", ["requested", "confirmed"])
      .order("start_ts", { ascending: true })
      .limit(1),

    // Unpaid completed bookings
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "completed")
      .eq("payment_status", "unpaid"),

    // This week revenue (paid/cash_paid completed bookings)
    supabaseAdmin
      .from("bookings")
      .select("total_price_cents")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .in("payment_status", ["paid", "cash_paid"])
      .gte("start_ts", weekAgo.toISOString()),

    // Last week revenue for comparison
    supabaseAdmin
      .from("bookings")
      .select("total_price_cents")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .in("payment_status", ["paid", "cash_paid"])
      .gte("start_ts", twoWeeksAgo.toISOString())
      .lt("start_ts", weekAgo.toISOString()),

    // Completed appointments this week
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("start_ts", weekAgo.toISOString()),

    // New customers this month
    supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", monthStart.toISOString()),

    // Total customers
    supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id),

    // App installs
    supabaseAdmin
      .from("pwa_installs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id),

    // Recent 6 bookings for activity feed
    supabaseAdmin
      .from("bookings")
      .select("id, start_ts, status, payment_status, total_price_cents, customers(full_name, phone), services(name)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(6),

    // Active Elite members
    supabaseAdmin
      .from("member_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "active"),
  ]);

  const thisWeekRevCents = (thisWeekPaid ?? []).reduce((s, b) => s + (b.total_price_cents ?? 0), 0);
  const lastWeekRevCents = (lastWeekPaid ?? []).reduce((s, b) => s + (b.total_price_cents ?? 0), 0);
  const revChange = lastWeekRevCents === 0
    ? null
    : Math.round(((thisWeekRevCents - lastWeekRevCents) / lastWeekRevCents) * 100);

  const next = nextUpcoming?.[0];
  const nextInMinutes = next
    ? Math.round((new Date(next.start_ts).getTime() - now.getTime()) / 60000)
    : null;

  const todayActive = (todayBookings ?? []).filter((b) => b.status !== "cancelled");
  const hasActionItems = (unpaidCount ?? 0) > 0;

  const today = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400">{today}</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">
          {greeting()}, {business.name} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your business at a glance</p>
      </div>

      {/* Action Items — only shown when something needs attention */}
      {hasActionItems && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3 flex-wrap">
          <span className="text-amber-700 font-semibold text-sm">⚠ Needs attention:</span>
          {(unpaidCount ?? 0) > 0 && (
            <Link
              href="/admin/payments"
              className="text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              {unpaidCount} unpaid booking{unpaidCount !== 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}

      {/* Today snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-1">Today&apos;s Appointments</p>
          <p className="text-5xl font-bold text-gray-900">{todayActive.length}</p>
          <Link
            href="/admin/bookings"
            className="text-sm text-purple-600 font-medium mt-3 inline-block hover:text-purple-700"
          >
            View full schedule →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm">
          {next ? (
            <>
              <p className="text-purple-200 text-sm font-medium mb-1">Next Appointment</p>
              <p className="text-2xl font-bold">{formatTime(next.start_ts, tz)}</p>
              <p className="font-semibold mt-1">
                {pick(next.customers, "full_name") || pick(next.customers, "phone")}
              </p>
              <p className="text-purple-200 text-sm">{pick(next.services, "name")}</p>
              {nextInMinutes !== null && (
                <p className="text-purple-100 text-xs mt-2">
                  {nextInMinutes <= 0
                    ? "Starting now"
                    : nextInMinutes < 60
                    ? `In ${nextInMinutes} minute${nextInMinutes !== 1 ? "s" : ""}`
                    : `In ${Math.round(nextInMinutes / 60)} hour${Math.round(nextInMinutes / 60) !== 1 ? "s" : ""}`}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-purple-200 text-sm font-medium mb-2">Next Appointment</p>
              <p className="text-xl font-bold">Nothing coming up</p>
              <Link
                href={`/${business.slug}/services`}
                className="text-purple-200 text-sm mt-2 inline-block hover:text-white underline underline-offset-2"
              >
                Share your booking link →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* This week stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Revenue (7d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{dollars(thisWeekRevCents)}</p>
          {revChange !== null && (
            <p className={`text-xs font-semibold mt-1 ${revChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {revChange >= 0 ? "↑" : "↓"} {Math.abs(revChange)}% vs last week
            </p>
          )}
          {revChange === null && <p className="text-xs text-gray-400 mt-1">No comparison yet</p>}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Completed (7d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{thisWeekCompleted ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">appointments</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">New Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{newCustomers ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">this month</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{totalCustomers ?? 0}</p>
          <Link href="/admin/customers" className="text-xs text-purple-600 font-medium mt-1 inline-block hover:text-purple-700">
            View all →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/take-payment"
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition shadow-sm"
          >
            💳 Take Payment
          </Link>
          <Link
            href="/admin/bookings"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition shadow-sm"
          >
            📅 View Schedule
          </Link>
          <Link
            href="/admin/campaigns"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition shadow-sm"
          >
            📣 Send Campaign
          </Link>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition shadow-sm"
          >
            📈 Analytics
          </Link>
          <Link
            href="/admin/customers"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition shadow-sm"
          >
            👥 Customers
          </Link>
        </div>
      </div>

      {/* Two-column: Today's schedule + Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Today's Schedule */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-gray-900">Today&apos;s Schedule</p>
            <Link href="/admin/bookings" className="text-xs text-purple-600 font-medium hover:text-purple-700">
              Full schedule →
            </Link>
          </div>
          {todayActive.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-gray-400 text-sm">No appointments today</p>
              <Link
                href={`/${business.slug}/services`}
                className="text-sm text-purple-600 font-medium mt-2 inline-block hover:text-purple-700"
              >
                Share your booking link →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayActive.slice(0, 7).map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                  <p className="text-sm font-semibold text-gray-500 w-16 flex-shrink-0 tabular-nums">
                    {formatTime(b.start_ts, tz)}
                  </p>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {pick(b.customers, "full_name") || pick(b.customers, "phone")}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{pick(b.services, "name")}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    b.status === "confirmed"
                      ? "bg-green-100 text-green-700"
                      : b.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {b.status}
                  </span>
                </div>
              ))}
              {todayActive.length > 7 && (
                <div className="px-5 py-3 text-center">
                  <Link href="/admin/bookings" className="text-xs text-purple-600 font-medium hover:text-purple-700">
                    +{todayActive.length - 7} more →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-semibold text-gray-900">Recent Activity</p>
          </div>
          {(recentBookings ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-gray-400 text-sm">No recent activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(recentBookings ?? []).map((b) => {
                const icon =
                  b.status === "completed" ? "✅"
                  : b.status === "cancelled" ? "❌"
                  : b.status === "confirmed" ? "📅"
                  : "🕐";
                const label =
                  b.status === "completed"
                    ? `Completed · ${dollars(b.total_price_cents ?? 0)}`
                    : b.status === "cancelled"
                    ? "Cancelled"
                    : b.status === "confirmed"
                    ? "Confirmed"
                    : "Requested";
                return (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {pick(b.customers, "full_name") || pick(b.customers, "phone")}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {pick(b.services, "name")} · {label}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
                      {new Date(b.start_ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Growth Signals */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Growth Signals</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/installs"
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition"
          >
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
              <span className="text-lg">📲</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{appInstalls ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">App Installs</p>
          </Link>

          <Link
            href="/admin/referrals"
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition"
          >
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
              <span className="text-lg">🎁</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-400 mt-0.5">Referrals</p>
          </Link>

          <Link
            href="/admin/membership"
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
              <span className="text-lg">💎</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activeMembers ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Elite Members</p>
          </Link>

          <Link
            href="/admin/network"
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition"
          >
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
              <span className="text-lg">🤝</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-400 mt-0.5">Network Partners</p>
          </Link>
        </div>
      </div>

    </div>
  );
}
