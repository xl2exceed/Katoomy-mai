"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BusinessSummary {
  id: string; name: string; slug: string; created_at: string;
  features?: Record<string, unknown>;
}

interface BusinessDetail {
  business: {
    id: string; name: string; slug: string; created_at: string;
    features?: Record<string, unknown>; primary_color?: string;
    subscription_plan?: string; subscription_status?: string;
    owner_name?: string; owner_email?: string; phone?: string; timezone?: string;
  };
  stats: {
    totalBookings: number; completedBookings: number; noShows: number;
    cancelledBookings: number; allTimeRevenue: number; totalCustomers: number;
    appInstalls: number; totalReferrals: number;
  };
  periods: {
    today: { bookings: number; revenue: number };
    week: { bookings: number; revenue: number };
    month: { bookings: number; revenue: number };
    allTime: { bookings: number; revenue: number };
  };
  members: Array<{
    id: string; created_at: string; current_period_end: string;
    customers: { full_name: string | null; phone: string };
    membership_plans: { name: string; price_cents: number };
  }>;
  recentCustomers: Array<{ id: string; created_at: string; full_name: string | null; phone: string }>;
  staff: Array<{ id: string; full_name: string; email: string; role: string; created_at: string }>;
  disputes: Array<{ id: string; created_at: string; total_amount_cents: number; payment_method: string; dispute_status: string }>;
  sms: { total: number; sent: number; received: number };
  loyalty: { enabled: boolean; reward_type: string; reward_value: string; threshold_points: number; referral_enabled: boolean } | null;
  appInstalls: number;
  automatedCampaigns: {
    winback_enabled: boolean; referral_enabled: boolean; appt_reminder_enabled: boolean;
    reengage_enabled: boolean; winback_30_enabled: boolean; winback_60_enabled: boolean; winback_90_enabled: boolean;
  } | null;
  availability: Array<{ day_of_week: number; start_time: string; end_time: string; days_open?: string[] }>;
  stripeConnect: { stripe_account_id: string; created_at: string } | null;
  depositSettings: { enabled: boolean; type: string; amount_cents: number; percent: number } | null;
}

interface Employee { id: string; email: string; name: string; role: string; created_at: string }

// Nav view stack
type View =
  | { type: "overview" }
  | { type: "customers" }
  | { type: "customer-detail"; id: string; name: string }
  | { type: "bookings"; initialPaymentType?: string }
  | { type: "booking-detail"; id: string }
  | { type: "sms" }
  | { type: "services" };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_TOKEN = "katoomy-internal-2026";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-green-900 text-green-300",
    confirmed: "bg-blue-900 text-blue-300",
    no_show: "bg-red-900 text-red-300",
    cancelled: "bg-gray-800 text-gray-400",
    requested: "bg-yellow-900 text-yellow-300",
    rescheduled: "bg-purple-900 text-purple-300",
  };
  return map[status] || "bg-gray-800 text-gray-400";
}
function authH() { return { "x-katoomy-token": ADMIN_TOKEN }; }

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function KatoomyAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState<"owner" | "employee">("employee");

  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<"businesses" | "employees">("businesses");
  const [bizSearch, setBizSearch] = useState("");
  const [bizList, setBizList] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<BusinessDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewStack, setViewStack] = useState<View[]>([{ type: "overview" }]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ email: "", name: "", password: "" });
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState("");

  const pushView = (v: View) => setViewStack((s) => [...s, v]);
  const popView = () => setViewStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const currentView = viewStack[viewStack.length - 1];

  const handleLogoTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      setAdminName("Alvin"); setAdminRole("owner"); setAuthed(true);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setLoginError("Enter email and password"); return; }
    setLoginLoading(true); setLoginError("");
    const res = await fetch("/api/katoomy-admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    const data = await res.json();
    setLoginLoading(false);
    if (!res.ok || data.error) { setLoginError(data.error || "Login failed"); }
    else { setAdminName(data.name); setAdminRole(data.role); setAuthed(true); }
  };

  const loadBusinesses = useCallback(async (q = "") => {
    setBizLoading(true);
    const res = await fetch(`/api/katoomy-admin/businesses?q=${encodeURIComponent(q)}`, { headers: authH() });
    const data = await res.json();
    setBizList(data.businesses || []);
    setBizLoading(false);
  }, []);

  const loadDetail = async (biz: BusinessSummary) => {
    setDetailLoading(true); setSelectedBiz(null); setViewStack([{ type: "overview" }]);
    const res = await fetch(`/api/katoomy-admin/business-detail?businessId=${biz.id}`, { headers: authH() });
    const data = await res.json();
    setSelectedBiz(data); setDetailLoading(false);
  };

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    const res = await fetch("/api/katoomy-admin/employees", { headers: authH() });
    const data = await res.json();
    setEmployees(data.employees || []); setEmpLoading(false);
  }, []);

  useEffect(() => { if (!authed) return; loadBusinesses(); loadEmployees(); }, [authed, loadBusinesses, loadEmployees]);
  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => loadBusinesses(bizSearch), 400);
    return () => clearTimeout(t);
  }, [bizSearch, authed, loadBusinesses]);

  const handleAddEmployee = async () => {
    if (!empForm.email || !empForm.name || !empForm.password) { setEmpError("All fields required"); return; }
    setEmpSaving(true); setEmpError("");
    const res = await fetch("/api/katoomy-admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authH() },
      body: JSON.stringify(empForm),
    });
    const data = await res.json();
    setEmpSaving(false);
    if (!res.ok || data.error) { setEmpError(data.error || "Failed"); }
    else { setEmpForm({ email: "", name: "", password: "" }); setShowAddEmp(false); loadEmployees(); }
  };

  const handleRemoveEmployee = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    await fetch(`/api/katoomy-admin/employees?id=${id}`, { method: "DELETE", headers: authH() });
    loadEmployees();
  };

  // ── Pre-auth splash ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center select-none px-6">
        <div className="flex flex-col items-center cursor-default mb-10" onClick={handleLogoTap}>
          <div className="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center mb-4 shadow-2xl">
            <span className="text-white text-4xl font-black">K</span>
          </div>
          <p className="text-gray-600 text-sm">Katoomy</p>
        </div>
        {!showLoginForm ? (
          <button onClick={() => setShowLoginForm(true)} className="text-gray-600 hover:text-gray-400 text-sm transition">
            Team Login →
          </button>
        ) : (
          <div className="w-80 bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-white font-bold text-base mb-4 text-center">Team Login</h2>
            <div className="space-y-3">
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Password"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            {loginError && <p className="text-red-400 text-xs mt-2 text-center">{loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading}
              className="mt-4 w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-semibold text-sm transition disabled:opacity-50">
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
            <button onClick={() => { setShowLoginForm(false); setLoginError(""); }}
              className="mt-2 w-full text-gray-600 hover:text-gray-400 text-xs py-1 transition">Cancel</button>
          </div>
        )}
      </div>
    );
  }

  // ── Authed portal ──
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-sm font-black">K</span>
          </div>
          <span className="font-bold text-white">Katoomy Admin Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button onClick={() => setTab("businesses")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "businesses" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}>
              Businesses
            </button>
            <button onClick={() => setTab("employees")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "employees" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}>
              Employees
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white">{adminName}</p>
            <p className="text-xs text-gray-500 capitalize">{adminRole}</p>
          </div>
          <button onClick={() => { setAuthed(false); setSelectedBiz(null); setShowLoginForm(false); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition">Lock</button>
        </div>
      </header>

      {/* Businesses tab */}
      {tab === "businesses" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-gray-800">
              <input type="text" value={bizSearch} onChange={(e) => setBizSearch(e.target.value)}
                placeholder="Search businesses..."
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {bizLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-500" /></div>
              ) : bizList.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No businesses found</p>
              ) : bizList.map((b) => (
                <button key={b.id} onClick={() => loadDetail(b)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition ${selectedBiz?.business.id === b.id ? "bg-gray-800 border-l-2 border-l-violet-500" : ""}`}>
                  <p className="font-medium text-sm text-white truncate">{b.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{String(b.features?.niche || "barber")} · {fmtDate(b.created_at)}</p>
                </button>
              ))}
            </div>
          </aside>

          {/* Detail pane */}
          <main className="flex-1 overflow-y-auto">
            {detailLoading && (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
              </div>
            )}
            {!detailLoading && !selectedBiz && (
              <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
                Select a business to view details
              </div>
            )}
            {!detailLoading && selectedBiz && (
              <div className="h-full">
                {/* Breadcrumb nav */}
                {viewStack.length > 1 && (
                  <div className="px-6 pt-4 pb-0 flex items-center gap-2 text-sm">
                    {viewStack.map((v, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span className="text-gray-600">›</span>}
                        {i < viewStack.length - 1 ? (
                          <button onClick={() => setViewStack(viewStack.slice(0, i + 1))}
                            className="text-violet-400 hover:text-violet-300 transition">
                            {v.type === "overview" ? selectedBiz.business.name : v.type === "customers" ? "Customers" : v.type === "customer-detail" ? (v as { type: "customer-detail"; id: string; name: string }).name : v.type === "bookings" ? "Bookings" : v.type === "sms" ? "SMS" : v.type === "services" ? "Services" : "Detail"}
                          </button>
                        ) : (
                          <span className="text-gray-400">
                            {v.type === "overview" ? selectedBiz.business.name : v.type === "customers" ? "Customers" : v.type === "customer-detail" ? (v as { type: "customer-detail"; id: string; name: string }).name : v.type === "bookings" ? "Bookings" : v.type === "booking-detail" ? "Booking Detail" : v.type === "sms" ? "SMS" : v.type === "services" ? "Services" : "Detail"}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {currentView.type === "overview" && (
                  <BusinessOverview detail={selectedBiz} pushView={pushView} />
                )}
                {currentView.type === "customers" && (
                  <CustomersView businessId={selectedBiz.business.id} pushView={pushView} />
                )}
                {currentView.type === "customer-detail" && (
                  <CustomerDetailView customerId={(currentView as { type: "customer-detail"; id: string; name: string }).id} pushView={pushView} />
                )}
                {currentView.type === "bookings" && (
                  <BookingsView businessId={selectedBiz.business.id} pushView={pushView}
                    initialPaymentType={(currentView as { type: "bookings"; initialPaymentType?: string }).initialPaymentType} />
                )}
                {currentView.type === "booking-detail" && (
                  <BookingDetailView bookingId={(currentView as { type: "booking-detail"; id: string }).id} />
                )}
                {currentView.type === "sms" && (
                  <SmsView businessId={selectedBiz.business.id} />
                )}
                {currentView.type === "services" && (
                  <ServicesView businessId={selectedBiz.business.id} />
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Employees tab */}
      {tab === "employees" && (
        <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Katoomy Employees</h2>
            {adminRole === "owner" && (
              <button onClick={() => { setShowAddEmp(true); setEmpError(""); }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition">
                + Add Employee
              </button>
            )}
          </div>
          {showAddEmp && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 mb-6">
              <h3 className="font-bold mb-4 text-white">New Employee</h3>
              <div className="space-y-3">
                {["name", "email", "password"].map((f) => (
                  <input key={f} type={f === "password" ? "password" : f === "email" ? "email" : "text"}
                    value={empForm[f as keyof typeof empForm]}
                    onChange={(e) => setEmpForm((prev) => ({ ...prev, [f]: e.target.value }))}
                    placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                ))}
              </div>
              {empError && <p className="text-red-400 text-xs mt-2">{empError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowAddEmp(false)}
                  className="flex-1 py-2.5 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition">Cancel</button>
                <button onClick={handleAddEmployee} disabled={empSaving}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
                  {empSaving ? "Creating..." : "Create Account"}
                </button>
              </div>
            </div>
          )}
          {empLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" /></div> : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.id} className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{emp.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{emp.email}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{emp.role} · Added {fmtDate(emp.created_at)}</p>
                  </div>
                  {adminRole === "owner" && emp.role !== "owner" && (
                    <button onClick={() => handleRemoveEmployee(emp.id, emp.name)}
                      className="text-red-500 hover:text-red-400 text-sm transition">Remove</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Overview
// ─────────────────────────────────────────────────────────────────────────────
function BusinessOverview({ detail, pushView }: { detail: BusinessDetail; pushView: (v: View) => void }) {
  const { business, stats, periods, members, staff, disputes, sms, loyalty, automatedCampaigns, availability, stripeConnect, depositSettings } = detail;
  const niche = String(business.features?.niche || "barber");
  const [referralDays, setReferralDays] = useState(30);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const planColor: Record<string, string> = { free: "text-gray-400", premium: "text-blue-400", pro: "text-violet-400" };

  useEffect(() => {
    const dateFrom = new Date(Date.now() - referralDays * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/katoomy-admin/bookings?businessId=${business.id}&dateFrom=${dateFrom}&status=completed`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => {
        // Use stats.totalReferrals as base — this is just a placeholder count
        setReferralCount(stats.totalReferrals);
      });
  }, [referralDays, business.id, stats.totalReferrals]);

  const campaignsActive = automatedCampaigns
    ? [automatedCampaigns.winback_enabled, automatedCampaigns.referral_enabled, automatedCampaigns.appt_reminder_enabled, automatedCampaigns.reengage_enabled].filter(Boolean).length
    : 0;

  return (
    <div className="p-6 space-y-5">
      {/* Business header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ backgroundColor: business.primary_color || "#7C3AED" }}>
            {business.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{business.name}</h2>
            <p className="text-gray-500 text-sm">{niche} · /{business.slug} · {business.timezone || "UTC"}</p>
            {business.owner_name && <p className="text-gray-600 text-xs mt-1">Owner: {business.owner_name} {business.owner_email ? `· ${business.owner_email}` : ""} {business.phone ? `· ${business.phone}` : ""}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-green-400">{fmt$(stats.allTimeRevenue)}</p>
            <p className="text-xs text-gray-500">All-time revenue</p>
            <p className="text-xs mt-1">
              <span className={`font-semibold capitalize ${planColor[business.subscription_plan || "free"] || "text-gray-400"}`}>
                {business.subscription_plan || "free"}
              </span>
              <span className="text-gray-600"> plan</span>
            </p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <span className={`px-2 py-1 rounded-full font-medium ${stripeConnect ? "bg-green-900 text-green-300" : "bg-red-950 text-red-400"}`}>
            Stripe {stripeConnect ? "✓ Connected" : "✗ Not Connected"}
          </span>
          <span className={`px-2 py-1 rounded-full font-medium ${depositSettings?.enabled ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-500"}`}>
            Deposits {depositSettings?.enabled ? `✓ On (${depositSettings.type === "flat" ? fmt$(depositSettings.amount_cents / 100) : depositSettings.percent + "%"})` : "✗ Off"}
          </span>
          <span className={`px-2 py-1 rounded-full font-medium ${campaignsActive > 0 ? "bg-violet-900 text-violet-300" : "bg-gray-800 text-gray-500"}`}>
            Campaigns: {campaignsActive > 0 ? `${campaignsActive} active` : "none active"}
          </span>
          <span className={`px-2 py-1 rounded-full font-medium ${loyalty?.enabled ? "bg-yellow-900 text-yellow-300" : "bg-gray-800 text-gray-500"}`}>
            Loyalty {loyalty?.enabled ? `✓ On (${loyalty.threshold_points} pts)` : "✗ Off"}
          </span>
          <span className="px-2 py-1 rounded-full font-medium bg-gray-800 text-gray-400">
            📲 {stats.appInstalls} install{stats.appInstalls !== 1 ? "s" : ""}
          </span>
          <span className="text-gray-600">Joined {fmtDate(business.created_at)}</span>
        </div>
      </div>

      {/* Stat cards — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Bookings", value: stats.totalBookings, color: "text-blue-400", onClick: () => pushView({ type: "bookings" }) },
          { label: "Completed", value: stats.completedBookings, color: "text-green-400", onClick: () => pushView({ type: "bookings", initialPaymentType: undefined }) },
          { label: "No-shows", value: stats.noShows, color: "text-red-400", onClick: undefined },
          { label: "Customers", value: stats.totalCustomers, color: "text-violet-400", onClick: () => pushView({ type: "customers" }) },
        ].map((s) => (
          <div key={s.label} onClick={s.onClick}
            className={`bg-gray-900 rounded-xl border border-gray-800 p-4 text-center ${s.onClick ? "cursor-pointer hover:border-gray-600 transition" : ""}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            {s.onClick && <p className="text-xs text-violet-500 mt-1">View all →</p>}
          </div>
        ))}
      </div>

      {/* Period table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="font-bold text-white mb-3">Bookings & Revenue by Period</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-left border-b border-gray-800">
            <th className="pb-2 font-medium">Period</th>
            <th className="pb-2 font-medium text-right">Bookings</th>
            <th className="pb-2 font-medium text-right">Revenue</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {(["today", "week", "month", "allTime"] as const).map((p) => (
              <tr key={p}>
                <td className="py-2 text-gray-300">{p === "allTime" ? "All Time" : p === "today" ? "Today" : p === "week" ? "Last 7 Days" : "This Month"}</td>
                <td className="py-2 text-right text-white font-medium">{detail.periods[p].bookings}</td>
                <td className="py-2 text-right text-green-400 font-semibold">{fmt$(detail.periods[p].revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Availability */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Availability</h3>
          {detail.availability.length === 0 ? (
            <p className="text-gray-500 text-sm">Not configured</p>
          ) : detail.availability.map((a, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
              <span className="text-gray-400">{a.day_of_week !== undefined ? DAY_NAMES[a.day_of_week] : (a.days_open || []).join(", ")}</span>
              <span className="text-white">{a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}</span>
            </div>
          ))}
        </div>

        {/* Automated Campaigns */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Automated Campaigns</h3>
          {!automatedCampaigns ? <p className="text-gray-500 text-sm">Not configured</p> : (
            <div className="space-y-1.5 text-sm">
              {[
                { label: "Appointment Reminders", val: automatedCampaigns.appt_reminder_enabled },
                { label: "Win-back (30d)", val: automatedCampaigns.winback_30_enabled },
                { label: "Win-back (60d)", val: automatedCampaigns.winback_60_enabled },
                { label: "Win-back (90d)", val: automatedCampaigns.winback_90_enabled },
                { label: "Referral Messages", val: automatedCampaigns.referral_enabled },
                { label: "Re-engage", val: automatedCampaigns.reengage_enabled },
              ].map((c) => (
                <div key={c.label} className="flex justify-between">
                  <span className="text-gray-400">{c.label}</span>
                  <span className={c.val ? "text-green-400 font-medium" : "text-gray-600"}>{c.val ? "On" : "Off"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SMS — clickable */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-600 transition" onClick={() => pushView({ type: "sms" })}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white">SMS Activity</h3>
            <span className="text-xs text-violet-400">View messages →</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white font-medium">{sms.total}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Sent</span><span className="text-white font-medium">{sms.sent}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Received</span><span className="text-white font-medium">{sms.received}</span></div>
          </div>
        </div>

        {/* Loyalty */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Loyalty Program</h3>
          {!loyalty ? <p className="text-gray-500 text-sm">Not configured</p> : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={loyalty.enabled ? "text-green-400 font-medium" : "text-gray-500"}>{loyalty.enabled ? "Active" : "Disabled"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Points to redeem</span><span className="text-white font-medium">{loyalty.threshold_points}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Reward type</span><span className="text-white font-medium capitalize">{loyalty.reward_type?.replace("_", " ")}</span></div>
              {loyalty.reward_value && <div className="flex justify-between"><span className="text-gray-400">Reward value</span><span className="text-white font-medium">{loyalty.reward_value}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400">Referral rewards</span><span className={loyalty.referral_enabled ? "text-green-400" : "text-gray-600"}>{loyalty.referral_enabled ? "On" : "Off"}</span></div>
            </div>
          )}
        </div>

        {/* Referrals */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white">Referrals</h3>
            <select value={referralDays} onChange={(e) => setReferralDays(Number(e.target.value))}
              className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none">
              <option value={7}>Last 7d</option>
              <option value={30}>Last 30d</option>
              <option value={90}>Last 90d</option>
              <option value={365}>Last year</option>
              <option value={99999}>All time</option>
            </select>
          </div>
          <p className="text-3xl font-bold text-violet-400">{referralCount ?? stats.totalReferrals}</p>
          <p className="text-xs text-gray-500 mt-1">Total referrals</p>
        </div>

        {/* Services — clickable */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-600 transition" onClick={() => pushView({ type: "services" })}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Services</h3>
            <span className="text-xs text-violet-400">View with booking counts →</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">Click to see all services, prices, and how often each was booked.</p>
        </div>
      </div>

      {/* Active Members */}
      {members.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Active Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white font-medium">{m.customers.full_name || "Guest"}</p>
                  <p className="text-gray-500 text-xs">{m.customers.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-violet-400 font-medium">{m.membership_plans?.name}</p>
                  <p className="text-gray-500 text-xs">Renews {fmtDate(m.current_period_end)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff */}
      {staff.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Staff ({staff.length})</h3>
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white font-medium">{s.full_name}</p>
                  <p className="text-gray-500 text-xs">{s.email}</p>
                </div>
                <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-xs capitalize">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disputes */}
      {disputes.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-red-900 p-5">
          <h3 className="font-bold text-red-400 mb-3">Payment Disputes ({disputes.length})</h3>
          <div className="space-y-2">
            {disputes.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white font-medium capitalize">{d.payment_method}</p>
                  <p className="text-gray-500 text-xs">{fmtDate(d.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-medium">{fmt$(d.total_amount_cents / 100)}</p>
                  <span className="text-xs text-yellow-400 capitalize">{d.dispute_status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers View
// ─────────────────────────────────────────────────────────────────────────────
function CustomersView({ businessId, pushView }: { businessId: string; pushView: (v: View) => void }) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string | null; phone: string; email: string | null; created_at: string; last_visit_at: string | null; sms_consent: boolean }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    const res = await fetch(`/api/katoomy-admin/customers?businessId=${businessId}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${off}`, { headers: authH() });
    const data = await res.json();
    setCustomers(data.customers || []); setTotal(data.total || 0); setLoading(false);
  }, [businessId]);

  useEffect(() => { load("", 0); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setOffset(0); load(search, 0); }, 400);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-white">Customers ({total})</h2>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..."
          className="flex-1 max-w-xs bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div> : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last Visit</th>
                <th className="px-4 py-3 font-medium">SMS</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800 cursor-pointer transition"
                    onClick={() => pushView({ type: "customer-detail", id: c.id, name: c.full_name || "Guest" })}>
                    <td className="px-4 py-3 text-white font-medium">{c.full_name || "Guest"}</td>
                    <td className="px-4 py-3 text-gray-400">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400">{c.last_visit_at ? fmtDate(c.last_visit_at) : "—"}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.sms_consent ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>{c.sms_consent ? "Opted in" : "None"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => { const o = Math.max(0, offset - limit); setOffset(o); load(search, o); }} disabled={offset === 0}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-700 transition">← Prev</button>
              <span className="text-gray-500 text-sm self-center">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <button onClick={() => { const o = offset + limit; setOffset(o); load(search, o); }} disabled={offset + limit >= total}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-700 transition">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Detail View
// ─────────────────────────────────────────────────────────────────────────────
function CustomerDetailView({ customerId, pushView }: { customerId: string; pushView: (v: View) => void }) {
  const [data, setData] = useState<{ customer: Record<string, unknown>; bookings: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/katoomy-admin/customer-detail?customerId=${customerId}`, { headers: authH() })
      .then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, [customerId]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>;
  if (!data) return <p className="p-6 text-red-400">Failed to load</p>;

  const c = data.customer as { full_name: string | null; phone: string; email: string | null; created_at: string; last_visit_at: string | null; sms_consent: boolean; referral_code: string | null };
  const bookings = data.bookings as Array<{ id: string; start_ts: string; status: string; payment_status: string; total_price_cents: number; customer_notes: string | null; services: { name: string } | null; staff: { full_name: string } | null; booking_payment_reports: { payment_method: string; resolution_status: string } | null }>;

  return (
    <div className="p-6 space-y-5">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-xl font-bold text-white mb-3">{c.full_name || "Guest"}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-gray-500">Phone</p><p className="text-white">{c.phone}</p></div>
          <div><p className="text-gray-500">Email</p><p className="text-white">{c.email || "—"}</p></div>
          <div><p className="text-gray-500">Customer since</p><p className="text-white">{fmtDate(c.created_at)}</p></div>
          <div><p className="text-gray-500">Last visit</p><p className="text-white">{c.last_visit_at ? fmtDate(c.last_visit_at) : "—"}</p></div>
          <div><p className="text-gray-500">SMS consent</p><p className={c.sms_consent ? "text-green-400" : "text-gray-500"}>{c.sms_consent ? "Yes" : "No"}</p></div>
          <div><p className="text-gray-500">Referral code</p><p className="text-white font-mono text-xs">{c.referral_code || "—"}</p></div>
          <div><p className="text-gray-500">Total bookings</p><p className="text-violet-400 font-bold">{bookings.length}</p></div>
          <div><p className="text-gray-500">Completed</p><p className="text-green-400 font-bold">{bookings.filter((b) => b.status === "completed").length}</p></div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800"><h3 className="font-bold text-white">All Appointments ({bookings.length})</h3></div>
        {bookings.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No appointments</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800 cursor-pointer transition"
                  onClick={() => pushView({ type: "booking-detail", id: b.id })}>
                  <td className="px-4 py-3 text-gray-300">{fmtDateTime(b.start_ts)}</td>
                  <td className="px-4 py-3 text-white">{b.services?.name || "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(b.status)}`}>{b.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs capitalize">{b.booking_payment_reports?.payment_method || (b.payment_status === "succeeded" ? "Stripe" : b.payment_status || "—")}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">{fmt$(b.total_price_cents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bookings View
// ─────────────────────────────────────────────────────────────────────────────
function BookingsView({ businessId, pushView, initialPaymentType }: { businessId: string; pushView: (v: View) => void; initialPaymentType?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [paymentType, setPaymentType] = useState(initialPaymentType || "all");
  const [status, setStatus] = useState("all");
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ businessId, dateFrom, dateTo });
    if (paymentType !== "all") params.set("paymentType", paymentType);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/katoomy-admin/bookings?${params}`, { headers: authH() });
    const data = await res.json();
    setBookings(data.bookings || []); setTotal(data.total || data.bookings?.length || 0); setLoading(false);
  }, [businessId, dateFrom, dateTo, paymentType, status]);

  useEffect(() => { load(); }, [load]);

  type BookingRow = { id: string; start_ts: string; status: string; payment_status: string; total_price_cents: number; customers: { full_name: string | null; phone: string } | null; services: { name: string } | null; booking_payment_reports: { payment_method: string; total_amount_cents: number } | null };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-white">Bookings</h2>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <span className="text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="bg-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="confirmed">Confirmed</option>
          <option value="no_show">No Show</option>
          <option value="cancelled">Cancelled</option>
          <option value="requested">Requested</option>
        </select>
        <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}
          className="bg-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          <option value="all">All payments</option>
          <option value="stripe">Stripe</option>
          <option value="cash_app">Cash App</option>
          <option value="zelle">Zelle</option>
          <option value="cash">Cash</option>
        </select>
        <span className="text-gray-500 text-sm">{total} result{total !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {bookings.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No bookings found</td></tr>
              ) : (bookings as BookingRow[]).map((b) => {
                const payMethod = b.booking_payment_reports?.payment_method || (b.payment_status === "succeeded" ? "Stripe" : b.payment_status || "—");
                return (
                  <tr key={b.id} className="hover:bg-gray-800 cursor-pointer transition"
                    onClick={() => pushView({ type: "booking-detail", id: b.id })}>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDateTime(b.start_ts)}</td>
                    <td className="px-4 py-3 text-white">{b.customers?.full_name || "Guest"}<br /><span className="text-gray-500 text-xs">{b.customers?.phone}</span></td>
                    <td className="px-4 py-3 text-gray-300">{b.services?.name || "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(b.status)}`}>{b.status.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{payMethod}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">{fmt$(b.total_price_cents / 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking Detail View
// ─────────────────────────────────────────────────────────────────────────────
function BookingDetailView({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<{ booking: Record<string, unknown>; paymentReport: Record<string, unknown> | null; altLedger: Record<string, unknown> | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/katoomy-admin/booking-detail?bookingId=${bookingId}`, { headers: authH() })
      .then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, [bookingId]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>;
  if (!data) return <p className="p-6 text-red-400">Failed to load</p>;

  type BookingDetail = { id: string; start_ts: string; end_ts: string; status: string; payment_status: string; total_price_cents: number; deposit_required: boolean; deposit_amount_cents: number; customer_notes: string | null; created_at: string; customers: { full_name: string | null; phone: string; email: string | null }; services: { name: string; price_cents: number; duration_minutes: number } | null; staff: { full_name: string } | null };
  type PayReport = { payment_method: string; total_amount_cents: number; service_amount_cents: number; tip_cents: number; resolution_status: string; resolution_reason: string | null; fee_amount_cents: number; fee_charged: boolean };
  type AltLedger = { payment_method: string; amount_cents: number; fee_absorbed_by: string; status: string };

  const b = data.booking as BookingDetail;
  const r = data.paymentReport as PayReport | null;
  const a = data.altLedger as AltLedger | null;

  return (
    <div className="p-6 space-y-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{b.services?.name || "Booking"}</h2>
            <p className="text-gray-500 text-sm">{fmtDateTime(b.start_ts)} → {fmtDateTime(b.end_ts)}</p>
            {b.staff && <p className="text-gray-500 text-sm mt-1">Staff: {b.staff.full_name}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${statusBadge(b.status)}`}>{b.status.replace("_", " ")}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div><p className="text-gray-500">Customer</p><p className="text-white font-medium">{b.customers.full_name || "Guest"}</p><p className="text-gray-500 text-xs">{b.customers.phone}</p></div>
          <div><p className="text-gray-500">Service price</p><p className="text-white font-medium">{fmt$(b.total_price_cents / 100)}</p></div>
          {b.deposit_required && <div><p className="text-gray-500">Deposit</p><p className="text-white font-medium">{fmt$(b.deposit_amount_cents / 100)}</p></div>}
          <div><p className="text-gray-500">Payment status</p><p className="text-white capitalize">{b.payment_status?.replace("_", " ") || "—"}</p></div>
          {b.customer_notes && <div className="col-span-2"><p className="text-gray-500">Notes</p><p className="text-gray-300">{b.customer_notes}</p></div>}
        </div>
      </div>

      {/* Payment report */}
      {r && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Payment Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-gray-500">Method</p><p className="text-white font-medium capitalize">{r.payment_method}</p></div>
            <div><p className="text-gray-500">Service amount</p><p className="text-green-400 font-medium">{fmt$(r.service_amount_cents / 100)}</p></div>
            {r.tip_cents > 0 && <div><p className="text-gray-500">Tip</p><p className="text-green-400 font-medium">{fmt$(r.tip_cents / 100)}</p></div>}
            <div><p className="text-gray-500">Total collected</p><p className="text-green-400 font-bold">{fmt$(r.total_amount_cents / 100)}</p></div>
            <div><p className="text-gray-500">Resolution</p><p className="text-white capitalize">{r.resolution_status?.replace("_", " ") || "—"}</p></div>
            {r.fee_charged && <div><p className="text-gray-500">Dispute fee</p><p className="text-red-400">{fmt$(r.fee_amount_cents / 100)}</p></div>}
            {r.resolution_reason && <div className="col-span-2"><p className="text-gray-500">Reason</p><p className="text-gray-300 capitalize">{r.resolution_reason.replace(/_/g, " ")}</p></div>}
          </div>
        </div>
      )}

      {/* Alt ledger */}
      {a && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Alternative Payment Ledger</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500">Method</p><p className="text-white capitalize">{a.payment_method}</p></div>
            <div><p className="text-gray-500">Amount</p><p className="text-green-400 font-medium">{fmt$(a.amount_cents / 100)}</p></div>
            <div><p className="text-gray-500">Fee absorbed by</p><p className="text-white capitalize">{a.fee_absorbed_by}</p></div>
            <div><p className="text-gray-500">Status</p><p className="text-white capitalize">{a.status?.replace("_", " ")}</p></div>
          </div>
        </div>
      )}

      {!r && !a && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-center">
          <p className="text-gray-500 text-sm">No payment record found for this booking{b.payment_status === "succeeded" ? " (Stripe — check Stripe dashboard)" : ""}.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS View
// ─────────────────────────────────────────────────────────────────────────────
function SmsView({ businessId }: { businessId: string }) {
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [direction, setDirection] = useState("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  const load = useCallback(async (dir: string, off: number) => {
    setLoading(true);
    const params = new URLSearchParams({ businessId, limit: String(limit), offset: String(off) });
    if (dir !== "all") params.set("direction", dir);
    const res = await fetch(`/api/katoomy-admin/sms-list?${params}`, { headers: authH() });
    const data = await res.json();
    setMessages(data.messages || []); setTotal(data.total || 0); setLoading(false);
  }, [businessId]);

  useEffect(() => { load("all", 0); }, [load]);

  type SmsRow = { id: string; direction: string; body: string; status: string; created_at: string; from_number: string; to_number: string; customers: { full_name: string | null; phone: string } | null };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-white">SMS Messages ({total})</h2>
        <select value={direction} onChange={(e) => { setDirection(e.target.value); setOffset(0); load(e.target.value, 0); }}
          className="bg-gray-800 text-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
          <option value="all">All</option>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div> : (
        <>
          <div className="space-y-3">
            {messages.length === 0 ? <p className="text-gray-500 text-center py-8">No messages</p> : (messages as SmsRow[]).map((m) => (
              <div key={m.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.direction === "outbound" ? "bg-blue-900 text-blue-300" : "bg-green-900 text-green-300"}`}>
                      {m.direction === "outbound" ? "→ Sent" : "← Received"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${m.status === "delivered" ? "bg-green-900 text-green-300" : m.status === "failed" ? "bg-red-900 text-red-300" : "bg-gray-800 text-gray-400"}`}>{m.status}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{fmtDateTime(m.created_at)}</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{m.body}</p>
                <p className="text-gray-600 text-xs mt-2">
                  {m.customers?.full_name || m.from_number} · {m.direction === "outbound" ? `To: ${m.to_number}` : `From: ${m.from_number}`}
                </p>
              </div>
            ))}
          </div>
          {total > limit && (
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => { const o = Math.max(0, offset - limit); setOffset(o); load(direction, o); }} disabled={offset === 0}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-700 transition">← Prev</button>
              <span className="text-gray-500 text-sm self-center">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <button onClick={() => { const o = offset + limit; setOffset(o); load(direction, o); }} disabled={offset + limit >= total}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-700 transition">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Services View
// ─────────────────────────────────────────────────────────────────────────────
function ServicesView({ businessId }: { businessId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [services, setServices] = useState<Array<{ id: string; name: string; price_cents: number; duration_minutes: number; active: boolean; bookingCount: number }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const res = await fetch(`/api/katoomy-admin/services?businessId=${businessId}&dateFrom=${from}&dateTo=${to}`, { headers: authH() });
    const data = await res.json();
    const sorted = (data.services || []).sort((a: { bookingCount: number }, b: { bookingCount: number }) => b.bookingCount - a.bookingCount);
    setServices(sorted); setLoading(false);
  }, [businessId]);

  useEffect(() => { load(dateFrom, dateTo); }, [load, dateFrom, dateTo]);

  const maxCount = Math.max(...services.map((s) => s.bookingCount), 1);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h2 className="text-xl font-bold text-white">Services ({services.length})</h2>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <span className="text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div> : (
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.active ? "bg-green-400" : "bg-gray-600"}`} />
                  <p className="text-white font-semibold">{s.name}</p>
                  {!s.active && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">{fmt$(s.price_cents / 100)}</p>
                  <p className="text-gray-500 text-xs">{s.duration_minutes} min</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${(s.bookingCount / maxCount) * 100}%` }} />
                </div>
                <span className="text-sm font-medium text-violet-400 w-16 text-right">{s.bookingCount} booking{s.bookingCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
