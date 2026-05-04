"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  features?: Record<string, string>;
}

interface BusinessDetail {
  business: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    features?: Record<string, string>;
    primary_color?: string;
  };
  stats: {
    totalBookings: number;
    completedBookings: number;
    noShows: number;
    cancelledBookings: number;
    allTimeRevenue: number;
    totalCustomers: number;
  };
  periods: {
    today: { bookings: number; revenue: number };
    week: { bookings: number; revenue: number };
    month: { bookings: number; revenue: number };
    allTime: { bookings: number; revenue: number };
  };
  members: Array<{
    id: string;
    created_at: string;
    current_period_end: string;
    customers: { full_name: string | null; phone: string };
    membership_plans: { name: string; price_cents: number };
  }>;
  recentCustomers: Array<{
    id: string;
    created_at: string;
    full_name: string | null;
    phone: string;
  }>;
  staff: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
  }>;
  disputes: Array<{
    id: string;
    created_at: string;
    total_amount_cents: number;
    refund_amount_cents: number | null;
    payment_method: string;
    dispute_status: string;
  }>;
  sms: { total: number; sent: number; received: number };
  loyalty: { enabled: boolean; visits_required: number; reward_description: string } | null;
}

interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Internal token sent with every API request — matches KATOOMY_ADMIN_TOKEN env var
const ADMIN_TOKEN = "katoomy-internal-2026";

// ── Main Component ─────────────────────────────────────────────────────────
export default function KatoomyAdminPage() {
  // ── Auth state ──
  const [authed, setAuthed] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState<"owner" | "employee">("employee");

  // ── Secret tap ──
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Employee login form (shown on splash for team members) ──
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Tab ──
  const [tab, setTab] = useState<"businesses" | "employees">("businesses");

  // ── Businesses ──
  const [bizSearch, setBizSearch] = useState("");
  const [bizList, setBizList] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<BusinessDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Employees ──
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ email: "", name: "", password: "" });
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState("");

  // ── Secret tap handler: 7 taps = instant owner access ──
  const handleLogoTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      setAdminName("Alvin");
      setAdminRole("owner");
      setAuthed(true);
    }
  };

  // ── Employee login via email+password ──
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setLoginError("Enter email and password"); return; }
    setLoginLoading(true);
    setLoginError("");
    const res = await fetch("/api/katoomy-admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    const data = await res.json();
    setLoginLoading(false);
    if (!res.ok || data.error) {
      setLoginError(data.error || "Login failed");
    } else {
      setAdminName(data.name);
      setAdminRole(data.role);
      setAuthed(true);
    }
  };

  const authHeaders = { "x-katoomy-token": ADMIN_TOKEN };

  // ── Load businesses ──
  const loadBusinesses = useCallback(async (q = "") => {
    setBizLoading(true);
    const res = await fetch(`/api/katoomy-admin/businesses?q=${encodeURIComponent(q)}`, {
      headers: authHeaders,
    });
    const data = await res.json();
    setBizList(data.businesses || []);
    setBizLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load business detail ──
  const loadDetail = async (biz: BusinessSummary) => {
    setDetailLoading(true);
    setSelectedBiz(null);
    const res = await fetch(`/api/katoomy-admin/business-detail?businessId=${biz.id}`, {
      headers: authHeaders,
    });
    const data = await res.json();
    setSelectedBiz(data);
    setDetailLoading(false);
  };

  // ── Load employees ──
  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    const res = await fetch("/api/katoomy-admin/employees", {
      headers: authHeaders,
    });
    const data = await res.json();
    setEmployees(data.employees || []);
    setEmpLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadBusinesses();
    loadEmployees();
  }, [authed, loadBusinesses, loadEmployees]);

  // ── Search debounce ──
  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => loadBusinesses(bizSearch), 400);
    return () => clearTimeout(t);
  }, [bizSearch, authed, loadBusinesses]);

  // ── Add employee ──
  const handleAddEmployee = async () => {
    if (!empForm.email || !empForm.name || !empForm.password) {
      setEmpError("All fields required");
      return;
    }
    setEmpSaving(true);
    setEmpError("");
    const res = await fetch("/api/katoomy-admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(empForm),
    });
    const data = await res.json();
    setEmpSaving(false);
    if (!res.ok || data.error) {
      setEmpError(data.error || "Failed to create employee");
    } else {
      setEmpForm({ email: "", name: "", password: "" });
      setShowAddEmp(false);
      loadEmployees();
    }
  };

  // ── Remove employee ──
  const handleRemoveEmployee = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from Katoomy Admin?`)) return;
    await fetch(`/api/katoomy-admin/employees?id=${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    loadEmployees();
  };

  // ── Pre-auth splash ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center select-none px-6">
        {/* K logo — tap 7x for owner instant access */}
        <div
          className="flex flex-col items-center cursor-default mb-10"
          onClick={handleLogoTap}
        >
          <div className="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center mb-4 shadow-2xl">
            <span className="text-white text-4xl font-black">K</span>
          </div>
          <p className="text-gray-600 text-sm">Katoomy</p>
        </div>

        {/* Employee login form */}
        {!showLoginForm ? (
          <button
            onClick={() => setShowLoginForm(true)}
            className="text-gray-600 hover:text-gray-400 text-sm transition"
          >
            Team Login →
          </button>
        ) : (
          <div className="w-80 bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-white font-bold text-base mb-4 text-center">Team Login</h2>
            <div className="space-y-3">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Password"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            {loginError && (
              <p className="text-red-400 text-xs mt-2 text-center">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="mt-4 w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-semibold text-sm transition disabled:opacity-50"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
            <button
              onClick={() => { setShowLoginForm(false); setLoginError(""); }}
              className="mt-2 w-full text-gray-600 hover:text-gray-400 text-xs py-1 transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Authed portal ──
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-sm font-black">K</span>
          </div>
          <span className="font-bold text-white">Katoomy Admin Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTab("businesses")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "businesses" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Businesses
            </button>
            <button
              onClick={() => setTab("employees")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "employees" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Employees
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white">{adminName}</p>
            <p className="text-xs text-gray-500 capitalize">{adminRole}</p>
          </div>
          <button
            onClick={() => { setAuthed(false); setSelectedBiz(null); setShowLoginForm(false); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
          >
            Lock
          </button>
        </div>
      </header>

      {/* Businesses tab */}
      {tab === "businesses" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-800">
              <input
                type="text"
                value={bizSearch}
                onChange={(e) => setBizSearch(e.target.value)}
                placeholder="Search businesses..."
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {bizLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" />
                </div>
              ) : bizList.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No businesses found</p>
              ) : (
                bizList.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => loadDetail(b)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition ${selectedBiz?.business.id === b.id ? "bg-gray-800 border-l-2 border-l-violet-500" : ""}`}
                  >
                    <p className="font-medium text-sm text-white">{b.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.features?.niche || "barber"} · Joined {fmtDate(b.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Detail pane */}
          <main className="flex-1 overflow-y-auto p-6">
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
              <BusinessDetailView detail={selectedBiz} />
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
              <button
                onClick={() => { setShowAddEmp(true); setEmpError(""); }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition"
              >
                + Add Employee
              </button>
            )}
          </div>

          {showAddEmp && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 mb-6">
              <h3 className="font-bold mb-4 text-white">New Employee</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={empForm.name}
                  onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <input
                  type="email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email address"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <input
                  type="password"
                  value={empForm.password}
                  onChange={(e) => setEmpForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Temporary password"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              {empError && <p className="text-red-400 text-xs mt-2">{empError}</p>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowAddEmp(false)}
                  className="flex-1 py-2.5 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEmployee}
                  disabled={empSaving}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {empSaving ? "Creating..." : "Create Account"}
                </button>
              </div>
            </div>
          )}

          {empLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.id} className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{emp.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{emp.email}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {emp.role} · Added {fmtDate(emp.created_at)}
                    </p>
                  </div>
                  {adminRole === "owner" && emp.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveEmployee(emp.id, emp.name)}
                      className="text-red-500 hover:text-red-400 text-sm transition"
                    >
                      Remove
                    </button>
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

// ── Business Detail View ────────────────────────────────────────────────────
function BusinessDetailView({ detail }: { detail: BusinessDetail }) {
  const { business, stats, periods, members, recentCustomers, staff, disputes, sms, loyalty } = detail;
  const niche = business.features?.niche || "barber";

  return (
    <div className="space-y-6">
      {/* Business header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ backgroundColor: business.primary_color || "#7C3AED" }}
          >
            {business.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{business.name}</h2>
            <p className="text-gray-500 text-sm">
              {niche} · /{business.slug} · Joined {fmtDate(business.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-400">{fmt$(stats.allTimeRevenue)}</p>
            <p className="text-xs text-gray-500">All-time revenue</p>
          </div>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: stats.totalBookings, color: "text-blue-400" },
          { label: "Completed", value: stats.completedBookings, color: "text-green-400" },
          { label: "No-shows", value: stats.noShows, color: "text-red-400" },
          { label: "Customers", value: stats.totalCustomers, color: "text-violet-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Period breakdown */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="font-bold text-white mb-4">Booking & Revenue by Period</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-gray-800">
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium text-right">Bookings</th>
                <th className="pb-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(["today", "week", "month", "allTime"] as const).map((p) => (
                <tr key={p}>
                  <td className="py-2.5 text-gray-300 capitalize">{p === "allTime" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}</td>
                  <td className="py-2.5 text-right text-white font-medium">{periods[p].bookings}</td>
                  <td className="py-2.5 text-right text-green-400 font-semibold">{fmt$(periods[p].revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SMS */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">SMS Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total messages</span><span className="text-white font-medium">{sms.total}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Sent (outbound)</span><span className="text-white font-medium">{sms.sent}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Received (inbound)</span><span className="text-white font-medium">{sms.received}</span></div>
          </div>
        </div>

        {/* Loyalty */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-3">Loyalty Program</h3>
          {loyalty ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`font-medium ${loyalty.enabled ? "text-green-400" : "text-gray-500"}`}>{loyalty.enabled ? "Active" : "Disabled"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Visits required</span><span className="text-white font-medium">{loyalty.visits_required}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Reward</span><span className="text-white font-medium truncate ml-2">{loyalty.reward_description || "—"}</span></div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Not configured</p>
          )}
        </div>
      </div>

      {/* Active Members */}
      {members.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-4">Active Members ({members.length})</h3>
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
          <h3 className="font-bold text-white mb-4">Staff ({staff.length})</h3>
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white font-medium">{s.full_name}</p>
                  <p className="text-gray-500 text-xs">{s.email}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-xs capitalize">{s.role}</span>
                  <p className="text-gray-500 text-xs mt-1">Added {fmtDate(s.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Customers */}
      {recentCustomers.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-white mb-4">Recent Customers (last 10)</h3>
          <div className="space-y-2">
            {recentCustomers.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white font-medium">{c.full_name || "Guest"}</p>
                  <p className="text-gray-500 text-xs">{c.phone}</p>
                </div>
                <p className="text-gray-500 text-xs">{fmtDate(c.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Disputes */}
      {disputes.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-red-900 p-5">
          <h3 className="font-bold text-red-400 mb-4">Payment Disputes ({disputes.length})</h3>
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
