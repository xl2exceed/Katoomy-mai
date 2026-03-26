"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Period = "today" | "week" | "month" | "all";

interface StaffBreakdown {
  staffId: string;
  staffName: string;
  serviceRevenueCents: number;
  tipsCents: number;
  totalCents: number;
  count: number;
}

interface Transaction {
  id: string;
  date: string;
  staffName: string;
  customerName: string;
  serviceName: string;
  serviceAmountCents: number;
  tipAmountCents: number;
  totalCents: number;
}

interface RevenueData {
  serviceRevenueCents: number;
  tipsCents: number;
  totalRevenueCents: number;
  staffBreakdown: StaffBreakdown[];
  transactions: Transaction[];
}

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const periods: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All Time" },
];

export default function MobileAdminRevenuePage() {
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/revenue?period=${period}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/admin/mobile/menu" className="text-blue-600 font-medium mb-4 block">
        ← Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Revenue</h1>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${
              period === p.key
                ? "bg-blue-600 text-white shadow"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : !data ? (
        <p className="text-gray-500 text-center">Could not load revenue data.</p>
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Services</p>
              <p className="text-xl font-bold text-gray-900 break-all">{fmt(data.serviceRevenueCents)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Tips</p>
              <p className="text-xl font-bold text-gray-900 break-all">{fmt(data.tipsCents)}</p>
            </div>
          </div>
          <div className="bg-blue-600 rounded-xl p-5 min-w-0">
            <p className="text-xs font-semibold text-blue-100 uppercase mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-white break-all">{fmt(data.totalRevenueCents)}</p>
          </div>

          {/* Staff Breakdown */}
          {data.staffBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase px-4 pt-4 pb-2">By Staff Member</p>
              <div className="divide-y divide-gray-100">
                {data.staffBreakdown.map((s) => (
                  <div key={s.staffId} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{s.staffName}</p>
                      <p className="text-xs text-gray-500">{s.count} bookings · Tips: {fmt(s.tipsCents)}</p>
                    </div>
                    <p className="font-bold text-gray-900">{fmt(s.totalCents)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction List */}
          {data.transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase px-4 pt-4 pb-2">Transactions</p>
              <div className="divide-y divide-gray-100">
                {data.transactions.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {t.serviceName} &middot;{" "}
                        {new Date(t.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" "}
                        {new Date(t.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                      <p className="text-xs text-gray-500">{t.staffName} · Service: {fmt(t.serviceAmountCents)}</p>
                      {t.tipAmountCents > 0 && (
                        <p className="text-xs text-blue-600">Tip: {fmt(t.tipAmountCents)}</p>
                      )}
                    </div>
                    <p className="font-bold text-gray-900">{fmt(t.totalCents)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.transactions.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400">No paid bookings in this period</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
