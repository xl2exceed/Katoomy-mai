"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/components/Pagination";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

interface Transaction {
  id: string;
  date: string;
  customerName: string;
  serviceName: string;
  serviceAmountCents: number;
  tipAmountCents: number;
  totalCents: number;
}

interface RevenueStats {
  serviceRevenueCents: number;
  tipsCents: number;
  totalRevenueCents: number;
  transactions: Transaction[];
}

export default function StaffRevenuePage() {
  const router = useRouter();
  const supabase = createClient();

  const [staffId, setStaffId] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [stats, setStats] = useState<RevenueStats>({ serviceRevenueCents: 0, tipsCents: 0, totalRevenueCents: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(20);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (staffId) loadRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, period]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/staff/login"); return; }
    const { data: s } = await supabase.from("staff").select("id").eq("user_id", user.id).maybeSingle();
    if (!s) { router.push("/staff/login"); return; }
    setStaffId(s.id);
  }

  async function loadRevenue() {
    setLoading(true);
    setTxPage(1);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/staff/${staffId}/revenue?period=${period}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setLoading(false);
  }

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">
        Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Revenue</h1>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
              period === p.key
                ? "bg-emerald-600 text-white shadow"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Service Revenue
            </p>
            <p className="text-2xl font-bold break-all text-gray-900">{fmt(stats.serviceRevenueCents)}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Tips Collected
            </p>
            <p className="text-2xl font-bold break-all text-gray-900">{fmt(stats.tipsCents)}</p>
          </div>

          <div className="bg-emerald-600 rounded-xl shadow-sm p-6">
            <p className="text-sm font-semibold text-emerald-100 uppercase tracking-wide mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold break-all text-white">{fmt(stats.totalRevenueCents)}</p>
          </div>

          {stats.transactions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Transactions</p>
                <span className="text-xs text-gray-400">{stats.transactions.length} total</span>
              </div>
              <div className="divide-y divide-gray-100">
                {stats.transactions.slice((txPage - 1) * txPerPage, txPage * txPerPage).map((t) => (
                  <div key={t.id} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {t.serviceName} &middot;{" "}
                        {new Date(t.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" "}
                        {new Date(t.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                      <p className="text-xs text-gray-500">Service: {fmt(t.serviceAmountCents)}</p>
                      {t.tipAmountCents > 0 && (
                        <p className="text-xs text-emerald-600">Tip: {fmt(t.tipAmountCents)}</p>
                      )}
                    </div>
                    <p className="font-bold text-gray-900">{fmt(t.totalCents)}</p>
                  </div>
                ))}
              </div>
              <Pagination mobile
                total={stats.transactions.length} perPage={txPerPage} page={txPage}
                onPageChange={setTxPage} onPerPageChange={(n) => { setTxPerPage(n); setTxPage(1); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
