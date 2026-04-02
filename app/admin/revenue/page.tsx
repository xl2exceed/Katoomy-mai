"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/Pagination";

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

interface MembershipTransaction {
  id: string;
  date: string;
  customerName: string;
  planName: string;
  amountCents: number;
}

interface RevenueData {
  serviceRevenueCents: number;
  tipsCents: number;
  membershipRevenueCents: number;
  totalRevenueCents: number;
  staffBreakdown: StaffBreakdown[];
  transactions: Transaction[];
  membershipTransactions: MembershipTransaction[];
}

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const periods: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export default function AdminRevenuePage() {
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(20);
  const [memPage, setMemPage] = useState(1);
  const [memPerPage, setMemPerPage] = useState(20);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function load() {
    setLoading(true);
    setTxPage(1);
    setMemPage(1);
    const res = await fetch(`/api/admin/revenue?period=${period}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Revenue</h1>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              period === p.key
                ? "bg-purple-600 text-white shadow"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
        </div>
      ) : !data ? (
        <p className="text-gray-500">Could not load revenue data.</p>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Revenue</p>
              <p className="text-2xl font-bold text-gray-900 break-all">{fmt(data.serviceRevenueCents)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tips</p>
              <p className="text-2xl font-bold text-gray-900 break-all">{fmt(data.tipsCents)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Memberships</p>
              <p className="text-2xl font-bold text-gray-900 break-all">{fmt(data.membershipRevenueCents)}</p>
            </div>
            <div className="bg-purple-600 rounded-xl p-5 min-w-0">
              <p className="text-xs font-semibold text-purple-100 uppercase tracking-wide mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-white break-all">{fmt(data.totalRevenueCents)}</p>
            </div>
          </div>

          {/* Staff Breakdown */}
          {data.staffBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">By Staff Member</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Staff</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Bookings</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Services</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tips</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.staffBreakdown.map((s) => (
                    <tr key={s.staffId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{s.staffName}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{s.count}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{fmt(s.serviceRevenueCents)}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{fmt(s.tipsCents)}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{fmt(s.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transaction List */}
          {data.transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Transactions</h2>
                <span className="text-xs text-gray-400">{data.transactions.length} total</span>
              </div>
              <div className="divide-y divide-gray-100">
                {data.transactions.slice((txPage - 1) * txPerPage, txPage * txPerPage).map((t) => (
                  <div key={t.id} className="px-6 py-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{t.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {t.serviceName} &middot;{" "}
                        {new Date(t.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" "}
                        {new Date(t.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                        {" · "}{t.staffName}
                      </p>
                      <p className="text-xs text-gray-500">Service: {fmt(t.serviceAmountCents)}</p>
                      {t.tipAmountCents > 0 && (
                        <p className="text-xs text-purple-600">Tip: {fmt(t.tipAmountCents)}</p>
                      )}
                    </div>
                    <p className="font-bold text-gray-900">{fmt(t.totalCents)}</p>
                  </div>
                ))}
              </div>
              <Pagination
                total={data.transactions.length} perPage={txPerPage} page={txPage}
                onPageChange={setTxPage} onPerPageChange={(n) => { setTxPerPage(n); setTxPage(1); }}
              />
            </div>
          )}

          {/* Membership Transactions */}
          {data.membershipTransactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Membership Sign-ups</h2>
                <span className="text-xs text-gray-400">{data.membershipTransactions.length} total</span>
              </div>
              <div className="divide-y divide-gray-100">
                {data.membershipTransactions.slice((memPage - 1) * memPerPage, memPage * memPerPage).map((m) => (
                  <div key={m.id} className="px-6 py-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{m.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {m.planName} &middot;{" "}
                        {new Date(m.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900">{fmt(m.amountCents)}</p>
                  </div>
                ))}
              </div>
              <Pagination
                total={data.membershipTransactions.length} perPage={memPerPage} page={memPage}
                onPageChange={setMemPage} onPerPageChange={(n) => { setMemPerPage(n); setMemPage(1); }}
              />
            </div>
          )}

          {data.transactions.length === 0 && data.membershipTransactions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400 text-lg">No revenue in this period</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
