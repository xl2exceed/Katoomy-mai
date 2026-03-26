"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

type Tab = "overview" | "bookings" | "customers" | "revenue" | "payment";
type Period = "today" | "week" | "month" | "all";

interface Stats { todayBookings: number; upcomingBookings: number; customersServiced: number; serviceRevenueCents: number; tipsCents: number; totalRevenueCents: number; }
interface Booking { id: string; start_ts: string; status: string; total_price_cents: number; customer_notes: string | null; customers: { full_name: string; phone: string } | null; services: { name: string; duration_minutes: number } | null; }
interface Customer { id: string; full_name: string; phone: string; email: string | null; visits: number; lastVisit: string; lastService: string; totalRevenueCents: number; totalTipsCents: number; totalAttributedCents: number; }
interface Transaction { id: string; date: string; customerName: string; serviceName: string; serviceAmountCents: number; tipAmountCents: number; totalCents: number; }
interface ServiceItem { id: string; name: string; price_cents: number; duration_minutes: number; }
interface RevenueData { serviceRevenueCents: number; tipsCents: number; totalRevenueCents: number; transactions: Transaction[]; }

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  requested: "bg-yellow-100 text-yellow-800",
  checked_in: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  incomplete: "bg-orange-100 text-orange-700",
  rescheduled: "bg-purple-100 text-purple-800",
};

function formatPhone(value: string) { const n = value.replace(/\D/g, ""); if (n.length <= 3) return n; if (n.length <= 6) return "(" + n.slice(0,3) + ") " + n.slice(3); return "(" + n.slice(0,3) + ") " + n.slice(3,6) + "-" + n.slice(6,10); }
function fmtMoney(cents: number) { return "$" + (cents / 100).toFixed(2); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }

export default function StaffDashboardContent({
  staffId,
  staffName,
  businessId,
  isAdmin,
  token = "",
}: {
  staffId: string;
  staffName: string;
  businessId?: string;
  isAdmin: boolean;
  token?: string;
}) {
  void staffName; void isAdmin;
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingPeriod, setBookingPeriod] = useState<"upcoming" | "past" | "today" | "week" | "month">("upcoming");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("week");
  const [overviewBookings, setOverviewBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Take Payment state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tpService, setTpService] = useState("");
  const [tpName, setTpName] = useState("");
  const [tpPhone, setTpPhone] = useState("");
  const [tpBusy, setTpBusy] = useState(false);
  const [tpQrUrl, setTpQrUrl] = useState<string | null>(null);
  const [tpCashDone, setTpCashDone] = useState(false);
  const [tpError, setTpError] = useState("");

  const authHeaders = useCallback((): Record<string, string> => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const fetchStats = useCallback(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const r = await fetch(`/api/staff/${staffId}/stats?todayStart=${todayStart.toISOString()}&todayEnd=${todayEnd.toISOString()}`, { headers: authHeaders() });
    if (r.ok) { const json = await r.json(); setStats(json); }
  }, [staffId, authHeaders]);

  const fetchOverviewBookings = useCallback(async () => {
    const r = await fetch(`/api/staff/${staffId}/bookings?period=upcoming`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setOverviewBookings((d.bookings || []).slice(0, 5)); }
  }, [staffId, authHeaders]);

  const fetchBookings = useCallback(async (period: string, signal?: AbortSignal) => {
    let extra = "";
    if (period === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end   = new Date(); end.setHours(23, 59, 59, 999);
      extra = `&start=${start.toISOString()}&end=${end.toISOString()}`;
    } else if (period === "week") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      extra = `&start=${start.toISOString()}`;
    } else if (period === "month") {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      extra = `&start=${start.toISOString()}`;
    }
    try {
      const r = await fetch(`/api/staff/${staffId}/bookings?period=${period}${extra}`, { signal, headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setBookings(d.bookings || []); }
      else { setBookings([]); }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setBookings([]);
    }
  }, [staffId, authHeaders]);

  const fetchCustomers = useCallback(async () => {
    const r = await fetch(`/api/staff/${staffId}/customers`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setCustomers(d.customers || []); }
  }, [staffId, authHeaders]);

  const fetchRevenue = useCallback(async (p: Period) => {
    const r = await fetch(`/api/staff/${staffId}/revenue?period=${p}`, { headers: authHeaders() });
    if (r.ok) setRevenue(await r.json());
  }, [staffId, authHeaders]);


  const fetchServices = useCallback(async () => {
    if (!businessId) return;
    const r = await fetch(`/api/businesses/${businessId}/services`);
    if (r.ok) { const d = await r.json(); setServices(d.services || []); }
  }, [businessId]);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([fetchStats(), fetchOverviewBookings()]); setLoading(false); })();
  }, [fetchStats, fetchOverviewBookings]);

  useEffect(() => {
    if (tab !== "bookings") return;
    const ctrl = new AbortController();
    fetchBookings(bookingPeriod, ctrl.signal);
    return () => ctrl.abort();
  }, [tab, bookingPeriod, fetchBookings]);
  useEffect(() => { if (tab === "customers") fetchCustomers(); }, [tab, fetchCustomers]);
  useEffect(() => { if (tab === "revenue") fetchRevenue(revenuePeriod); }, [tab, revenuePeriod, fetchRevenue]);
  useEffect(() => { if (tab === "payment") fetchServices(); }, [tab, fetchServices]);

  const handleCash = async () => {
    if (!tpService || !tpName.trim() || !tpPhone.replace(/\D/g,"").length) { setTpError("Please fill in all fields."); return; }
    setTpBusy(true); setTpError(""); setTpQrUrl(null); setTpCashDone(false);
    const res = await fetch("/api/staff/take-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, mode: "cash", serviceId: tpService, customerName: tpName, customerPhone: tpPhone }),
    });
    const d = await res.json();
    setTpBusy(false);
    if (!res.ok || d.error) { setTpError(d.error || "Failed"); return; }
    setTpCashDone(true);
  };

  const handleQr = async () => {
    if (!tpService || !tpName.trim() || !tpPhone.replace(/\D/g,"").length) { setTpError("Please fill in all fields."); return; }
    setTpBusy(true); setTpError(""); setTpCashDone(false);
    const res = await fetch("/api/staff/take-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, mode: "card", serviceId: tpService, customerName: tpName, customerPhone: tpPhone }),
    });
    const d = await res.json();
    setTpBusy(false);
    if (!res.ok || d.error || !d.url) { setTpError(d.error || "Failed to create payment link"); return; }
    setTpQrUrl(d.url);
  };

  const resetTp = () => { setTpService(""); setTpName(""); setTpPhone(""); setTpQrUrl(null); setTpCashDone(false); setTpError(""); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const tabList: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "bookings", label: "Bookings" },
    { key: "customers", label: "Customers" },
    { key: "revenue", label: "Revenue" },
    { key: "payment", label: "Take Payment" },
  ];
  const selectedService = services.find((s) => s.id === tpService);

  return (
    <div>
      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabList.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Today's Bookings", value: String(stats?.todayBookings ?? 0) },
              { label: "Upcoming Bookings", value: String(stats?.upcomingBookings ?? 0) },
              { label: "Customers Serviced", value: String(stats?.customersServiced ?? 0) },
              { label: "Service Revenue Generated", value: fmtMoney(stats?.serviceRevenueCents ?? 0) },
              { label: "Tips Collected", value: fmtMoney(stats?.tipsCents ?? 0) },
              { label: "Total Revenue Attributed", value: fmtMoney(stats?.totalRevenueCents ?? 0) },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Next Appointments</h3>
            {overviewBookings.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-500">No upcoming appointments</div>
            ) : (
              <div className="space-y-2">
                {overviewBookings.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{b.customers?.full_name ?? "Unknown"}</p>
                      <p className="text-sm text-gray-500">{b.services?.name} &middot; {b.services?.duration_minutes}min</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmtDate(b.start_ts)}</p>
                      <p className="text-sm text-gray-500">{fmtTime(b.start_ts)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKINGS */}
      {tab === "bookings" && (
        <div>
          <div className="flex gap-2 mb-5 flex-wrap">
            {(["upcoming", "today", "week", "month", "past"] as const).map((p) => (
              <button key={p} onClick={() => setBookingPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${bookingPeriod === p ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {p === "week" ? "This Week" : p === "month" ? "This Month" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {bookings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">No bookings found</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{["Date", "Time", "Customer", "Service", "Status", "Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{fmtDate(b.start_ts)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmtTime(b.start_ts)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.customers?.full_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{b.services?.name ?? "Unknown"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmtMoney(b.total_price_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMERS */}
      {tab === "customers" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{customers.length} customer{customers.length !== 1 ? "s" : ""} serviced (all time)</p>
          {customers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">No customers serviced yet</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{["Customer", "Phone", "Visits", "Last Visit", "Last Service", "Service Revenue", "Tips", "Total Attributed"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{c.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{c.visits}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtDate(c.lastVisit)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.lastService}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmtMoney(c.totalRevenueCents)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmtMoney(c.totalTipsCents)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtMoney(c.totalAttributedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REVENUE */}
      {tab === "revenue" && (
        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {(["today", "week", "month", "all"] as Period[]).map((p) => (
              <button key={p} onClick={() => setRevenuePeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${revenuePeriod === p ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {p === "week" ? "This Week" : p === "month" ? "This Month" : p === "all" ? "All Time" : "Today"}
              </button>
            ))}
          </div>
          {revenue && (
            <>
              <div className="flex flex-col gap-3">
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 shadow-sm flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Revenue Generated</p>
                  <p className="text-xl font-bold text-gray-900">{fmtMoney(revenue.serviceRevenueCents)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 shadow-sm flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tips Collected</p>
                  <p className="text-xl font-bold text-gray-900">{fmtMoney(revenue.tipsCents)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 px-5 py-3 shadow-sm flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Revenue Attributed</p>
                  <p className="text-xl font-bold text-blue-700">{fmtMoney(revenue.totalRevenueCents)}</p>
                </div>
              </div>
              {revenue.transactions.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">No transactions in this period</div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
                  <table className="w-full min-w-max">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>{["Date", "Time", "Customer", "Service", "Service Amt", "Tip", "Total"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {revenue.transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtDate(t.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtTime(t.date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{t.customerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{t.serviceName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{fmtMoney(t.serviceAmountCents)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtMoney(t.tipAmountCents)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{fmtMoney(t.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAKE PAYMENT */}
      {tab === "payment" && (
        <div className="max-w-md">
          {!businessId ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
              Payment collection not available in this view.
            </div>
          ) : tpQrUrl ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4">
              <p className="font-semibold text-gray-900">Show this QR to the customer</p>
              <p className="text-sm text-gray-500">
                They scan it with their phone to pay {selectedService ? fmtMoney(selectedService.price_cents) : ""} securely.
              </p>
              <div className="flex justify-center">
                <QRCodeSVG value={tpQrUrl} size={220} />
              </div>
              <button onClick={resetTp} className="w-full bg-gray-100 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-200 text-sm mt-2">
                New Payment
              </button>
            </div>
          ) : tpCashDone ? (
            <div className="bg-white rounded-xl border border-green-200 p-8 text-center space-y-3">
              <p className="text-4xl">&#x2705;</p>
              <p className="font-semibold text-gray-900">Cash payment recorded!</p>
              <p className="text-sm text-gray-500">Booking created for {tpName}.</p>
              <button onClick={resetTp} className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 text-sm">
                New Payment
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 text-lg">Take Payment</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select
                  value={tpService}
                  onChange={(e) => setTpService(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {fmtMoney(s.price_cents)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={tpName}
                  onChange={(e) => setTpName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={tpPhone}
                  onChange={(e) => setTpPhone(formatPhone(e.target.value))}
                  maxLength={14}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {tpError && <p className="text-sm text-red-600">{tpError}</p>}
              {selectedService && (
                <p className="text-sm text-gray-600">Total: <span className="font-bold text-gray-900">{fmtMoney(selectedService.price_cents)}</span></p>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleCash}
                  disabled={tpBusy}
                  className="bg-green-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  &#x1F4B5; Customer Paid Cash
                </button>
                <button
                  onClick={handleQr}
                  disabled={tpBusy}
                  className="bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  &#x1F4F1; Tap / Scan to Pay
                </button>
              </div>
              {tpBusy && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span className="text-sm text-gray-500">Processing...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
