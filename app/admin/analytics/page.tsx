"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Period = "week" | "2weeks" | "month" | "3months" | "6months" | "custom";

interface PeriodMetrics {
  bookings: number;
  revenue: number;
  newCustomers: number;
  avgTicketCents: number;
  revenueLostCents: number;
  cancellations: number;
  noShows: number;
}
interface TrendPoint { label: string; current: number; previous: number }
interface DowCount { name: string; count: number }
interface HourCount { hour: string; count: number }
interface ServiceStat { name: string; count: number; revenueCents: number }
interface CustomerStat { id: string; name: string; spentCents: number }
interface AtRiskCustomer { id: string; name: string; lastVisit: string; daysSince: number }
interface Alert { type: "warning" | "info" | "success"; message: string }

interface AnalyticsData {
  period: Period;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  trend: TrendPoint[];
  bookingsByDayOfWeek: DowCount[];
  peakHours: HourCount[];
  topServices: ServiceStat[];
  newVsReturning: { newCount: number; returningCount: number; total: number };
  atRiskCustomers: AtRiskCustomer[];
  topCustomers: CustomerStat[];
  avgLTVCents: number;
  avgTicketCents: number;
  avgDaysBetweenVisits: number | null;
  rebookingRate: number;
  alerts: Alert[];
  totalCustomers: number;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Last 7 Days" },
  { key: "2weeks", label: "Last 2 Weeks" },
  { key: "month", label: "Last 30 Days" },
  { key: "3months", label: "Last 3 Months" },
  { key: "6months", label: "Last 6 Months" },
  { key: "custom", label: "Custom" },
];

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function Change({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return <span className="text-xs text-gray-400">No prior data</span>;
  const diff = ((current - previous) / previous) * 100;
  const positive = invert ? diff <= 0 : diff >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? "text-green-600" : "text-red-500"}`}>
      {diff >= 0 ? "+" : ""}{diff.toFixed(0)}%
    </span>
  );
}

function Bar({ value, max, color = "bg-purple-500" }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${w}%` }} />
    </div>
  );
}

const ALERT_STYLES = {
  warning: "bg-amber-50 border-amber-300 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
};
const ALERT_ICONS = { warning: "⚠️", info: "💡", success: "✅" };

export default function AnalyticsPage() {
  const pathname = usePathname();
  const isMobileRoute = pathname?.startsWith("/admin/mobile");
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [appInstalls, setAppInstalls] = useState<number | null>(null);
  const [installPeriod, setInstallPeriod] = useState<"all" | "week" | "month" | "custom">("all");
  const [installStart, setInstallStart] = useState("");
  const [installEnd, setInstallEnd] = useState("");
  const [installCustomActive, setInstallCustomActive] = useState(false);

  function fetchInstalls(p: "all" | "week" | "month" | "custom", start?: string, end?: string) {
    setAppInstalls(null);
    let url = "/api/admin/app-installs";
    if (p === "week") url += "?period=week";
    else if (p === "month") url += "?period=month";
    else if (p === "custom" && start && end) url += `?period=custom&startDate=${start}&endDate=${end}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setAppInstalls(d.count ?? 0))
      .catch(() => setAppInstalls(0));
  }

  useEffect(() => {
    fetchInstalls("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInstallPeriod(p: "all" | "week" | "month" | "custom") {
    setInstallPeriod(p);
    if (p === "custom") {
      if (!installStart) setInstallStart(thirtyAgo);
      if (!installEnd) setInstallEnd(today);
      setInstallCustomActive(true);
    } else {
      setInstallCustomActive(false);
      fetchInstalls(p);
    }
  }

  // Default custom dates to last 30 days when switching to custom
  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  function load(p: Period, start?: string, end?: string) {
    setLoading(true);
    const url = p === "custom" && start && end
      ? `/api/admin/analytics?period=custom&startDate=${start}&endDate=${end}`
      : `/api/admin/analytics?period=${p}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (period !== "custom") load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  function handlePeriodClick(p: Period) {
    setPeriod(p);
    if (p === "custom") {
      if (!customStart) setCustomStart(thirtyAgo);
      if (!customEnd) setCustomEnd(today);
    }
  }

  function applyCustom() {
    if (customStart && customEnd) load("custom", customStart, customEnd);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 bg-white min-h-screen">
      <div className="flex flex-col gap-4">
        {isMobileRoute && (
          <a href="/admin/mobile/menu" className="text-sm text-gray-500">
            ← Back to Menu
          </a>
        )}
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePeriodClick(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                period === p.key
                  ? "bg-purple-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
              <input
                type="date" value={customStart} max={customEnd || today}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
              <input
                type="date" value={customEnd} min={customStart} max={today}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customStart || !customEnd}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 hover:bg-purple-700 transition"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        </div>
      ) : !data ? (
        <div className="text-gray-500">Could not load analytics.</div>
      ) : (
        <AnalyticsContent
          data={data}
          appInstalls={appInstalls}
          installPeriod={installPeriod}
          installStart={installStart}
          installEnd={installEnd}
          installCustomActive={installCustomActive}
          today={today}
          onInstallPeriod={handleInstallPeriod}
          onInstallStart={setInstallStart}
          onInstallEnd={setInstallEnd}
          onApplyInstallCustom={() => fetchInstalls("custom", installStart, installEnd)}
        />
      )}
    </div>
  );
}

function AnalyticsContent({
  data, appInstalls,
  installPeriod, installStart, installEnd, installCustomActive, today,
  onInstallPeriod, onInstallStart, onInstallEnd, onApplyInstallCustom,
}: {
  data: AnalyticsData;
  appInstalls: number | null;
  installPeriod: "all" | "week" | "month" | "custom";
  installStart: string;
  installEnd: string;
  installCustomActive: boolean;
  today: string;
  onInstallPeriod: (p: "all" | "week" | "month" | "custom") => void;
  onInstallStart: (v: string) => void;
  onInstallEnd: (v: string) => void;
  onApplyInstallCustom: () => void;
}) {
  const {
    currentPeriodLabel, previousPeriodLabel,
    current, previous, trend,
    bookingsByDayOfWeek, peakHours, topServices,
    newVsReturning, atRiskCustomers, topCustomers,
    avgLTVCents, avgTicketCents, avgDaysBetweenVisits, rebookingRate,
    alerts, totalCustomers,
  } = data;

  const maxTrend = Math.max(...trend.map(t => Math.max(t.current, t.previous)), 1);
  const maxDow = Math.max(...bookingsByDayOfWeek.map(d => d.count), 1);
  const maxHour = Math.max(...peakHours.map(h => h.count), 1);
  const maxService = Math.max(...topServices.map(s => s.count), 1);
  const maxSpend = Math.max(...topCustomers.map(c => c.spentCents), 1);
  const relevantHours = peakHours.filter((_, i) => i >= 6 && i <= 22);

  return (
    <div className="space-y-8">
      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 border rounded-xl px-4 py-3 text-sm font-medium ${ALERT_STYLES[a.type]}`}>
              <span>{ALERT_ICONS[a.type]}</span>
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Period comparison label */}
      <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" />{currentPeriodLabel} (current)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-300" />{previousPeriodLabel} (previous)</div>
      </div>

      {/* Summary Cards — current vs previous */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Bookings", cur: current.bookings, prev: previous.bookings, fmt: (v: number) => String(v) },
          { label: "Revenue", cur: current.revenue, prev: previous.revenue, fmt: (v: number) => fmt(v) },
          { label: "New Customers", cur: current.newCustomers, prev: previous.newCustomers, fmt: (v: number) => String(v) },
          { label: "Avg Ticket", cur: current.avgTicketCents, prev: previous.avgTicketCents, fmt: (v: number) => fmt(v) },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900">{card.fmt(card.cur)}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">prev: {card.fmt(card.prev)}</span>
              <Change current={card.cur} previous={card.prev} />
            </div>
          </div>
        ))}
      </div>

      {/* App Installs */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">App Installs</p>
            <p className="text-4xl font-bold text-gray-900">
              {appInstalls === null ? (
                <span className="inline-block h-9 w-12 bg-orange-200 animate-pulse rounded" />
              ) : appInstalls}
            </p>
            <p className="text-xs text-gray-500 mt-1">Customers who installed your app to their home screen</p>
          </div>
          <span className="text-5xl flex-shrink-0">📲</span>
        </div>

        {/* Period picker */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(["all", "week", "month", "custom"] as const).map(p => (
            <button
              key={p}
              onClick={() => onInstallPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                installPeriod === p
                  ? "bg-orange-500 text-white shadow"
                  : "bg-white text-gray-600 border border-orange-200 hover:bg-orange-50"
              }`}
            >
              {p === "all" ? "All Time" : p === "week" ? "Last 7 Days" : p === "month" ? "Last 30 Days" : "Custom"}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {installCustomActive && (
          <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-orange-200">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Start</label>
              <input
                type="date" value={installStart} max={installEnd || today}
                onChange={e => onInstallStart(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">End</label>
              <input
                type="date" value={installEnd} min={installStart} max={today}
                onChange={e => onInstallEnd(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              onClick={onApplyInstallCustom}
              disabled={!installStart || !installEnd}
              className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 hover:bg-orange-600 transition"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Money Intelligence */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Money Intelligence (All Time)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-purple-600 rounded-xl p-5 text-white">
            <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide mb-1">Avg Customer LTV</p>
            <p className="text-3xl font-bold">{fmt(avgLTVCents)}</p>
            <p className="text-xs text-purple-200 mt-1">avg spend per customer</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Ticket Size</p>
            <p className="text-3xl font-bold text-gray-900">{fmt(avgTicketCents)}</p>
            <p className="text-xs text-gray-400 mt-1">per completed booking</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rebooking Rate</p>
            <p className="text-3xl font-bold text-gray-900">{rebookingRate}%</p>
            <p className="text-xs text-gray-400 mt-1">customers who returned</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Visit Frequency</p>
            <p className="text-3xl font-bold text-gray-900">
              {avgDaysBetweenVisits !== null ? `${avgDaysBetweenVisits}d` : "--"}
            </p>
            <p className="text-xs text-gray-400 mt-1">avg days between visits</p>
          </div>
        </div>
      </div>

      {/* Missed Revenue */}
      {current.revenueLostCents > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-1">Missed Revenue This Period</h2>
            <div className="flex gap-4 text-sm text-red-600">
              <span>{current.cancellations} cancellation{current.cancellations !== 1 ? "s" : ""}</span>
              <span>{current.noShows} no-show{current.noShows !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-xs text-red-400 mt-1">Unpaid cancellations and no-shows only</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-red-600">{fmt(current.revenueLostCents)}</p>
            <Change current={current.revenueLostCents} previous={previous.revenueLostCents} invert />
          </div>
        </div>
      )}

      {/* Booking Trend Chart — current vs previous */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Booking Trend</h2>
        <div className="flex items-end gap-1 h-32">
          {trend.map((t) => (
            <div key={t.label} className="flex-1 flex gap-0.5 items-end justify-center group relative">
              {/* Previous bar */}
              <div
                className="flex-1 bg-gray-200 rounded-t group-hover:bg-gray-300 transition-colors min-h-[3px]"
                style={{ height: `${Math.max(3, Math.round((t.previous / maxTrend) * 128))}px` }}
              />
              {/* Current bar */}
              <div
                className="flex-1 bg-purple-500 rounded-t group-hover:bg-purple-700 transition-colors min-h-[3px]"
                style={{ height: `${Math.max(3, Math.round((t.current / maxTrend) * 128))}px` }}
              />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                {t.label}: {t.current} now / {t.previous} prev
              </div>
            </div>
          ))}
        </div>
        {/* X-axis labels — show a subset to avoid crowding */}
        <div className="flex mt-1">
          {trend.map((t, i) => (
            <div key={t.label} className="flex-1 text-center">
              {(i === 0 || i === Math.floor(trend.length / 2) || i === trend.length - 1) && (
                <span className="text-xs text-gray-400">{t.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Busiest Days */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Busiest Days of the Week</h2>
          <div className="space-y-3">
            {bookingsByDayOfWeek.map((d) => (
              <div key={d.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{d.name}</span>
                  <span className="text-gray-500">{d.count}</span>
                </div>
                <Bar value={d.count} max={maxDow} color="bg-purple-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Peak Hours</h2>
          <div className="space-y-3">
            {relevantHours.map((h) => (
              <div key={h.hour}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{h.hour}</span>
                  <span className="text-gray-500">{h.count}</span>
                </div>
                <Bar value={h.count} max={maxHour} color="bg-indigo-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Services */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Top Services</h2>
        {topServices.length === 0 ? (
          <p className="text-gray-400 text-sm">No completed bookings in this period.</p>
        ) : (
          <div className="space-y-4">
            {topServices.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-gray-500">{s.count} bookings &middot; {fmt(s.revenueCents)}</span>
                </div>
                <Bar value={s.count} max={maxService} color="bg-emerald-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* New vs Returning */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">New vs Returning</h2>
          {newVsReturning.total === 0 ? (
            <p className="text-gray-400 text-sm">No bookings in this period.</p>
          ) : (
            <>
              <div className="flex h-6 rounded-full overflow-hidden mb-4">
                <div className="bg-purple-500 transition-all" style={{ width: `${Math.round((newVsReturning.newCount / newVsReturning.total) * 100)}%` }} />
                <div className="bg-gray-200 flex-1" />
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-0.5"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-gray-600">New</span></div>
                  <p className="font-bold text-xl text-gray-900">{newVsReturning.newCount}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5"><div className="w-3 h-3 rounded-full bg-gray-300" /><span className="text-gray-600">Returning</span></div>
                  <p className="font-bold text-xl text-gray-900">{newVsReturning.returningCount}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5"><div className="w-3 h-3 rounded-full bg-gray-100 border" /><span className="text-gray-600">Total Customers</span></div>
                  <p className="font-bold text-xl text-gray-900">{totalCustomers}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Top Customers by Spend</h2>
          {topCustomers.length === 0 ? (
            <p className="text-gray-400 text-sm">No revenue data yet.</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800 truncate">{c.name}</span>
                      <span className="text-gray-500 ml-2 shrink-0">{fmt(c.spentCents)}</span>
                    </div>
                    <Bar value={c.spentCents} max={maxSpend} color="bg-orange-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* At-Risk Customers */}
      {atRiskCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">At-Risk Customers</h2>
            <span className="text-xs text-gray-400">Haven&apos;t visited in 30+ days</span>
          </div>
          <div className="divide-y divide-gray-100">
            {atRiskCustomers.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${c.daysSince > 60 ? "text-red-600" : "text-amber-500"}`}>
                    {c.daysSince} days ago
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(c.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
