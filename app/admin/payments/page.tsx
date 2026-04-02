"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LedgerEntry {
  id: string;
  business_id: string;
  booking_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string | null;
  service_amount_cents: number;
  tip_cents: number;
  platform_fee_cents: number;
  payment_method: string;
  fee_absorbed_by: string;
  billing_month: string;
  billing_status: string;
  marked_paid_at: string;
  notes: string | null;
  businesses?: { name: string; slug: string } | null;
}

interface MonthlyBilling {
  id: string;
  business_id: string;
  billing_month: string;
  total_transactions: number;
  total_fees_cents: number;
  status: string;
  stripe_charge_id: string | null;
  charged_at: string | null;
  failure_reason: string | null;
  businesses?: { name: string } | null;
}

export default function AdminPaymentsPage() {
  const supabase = createClient();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [billing, setBilling] = useState<MonthlyBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ledger" | "billing">("ledger");
  const [filterMonth, setFilterMonth] = useState("");
  const [triggeringBilling, setTriggeringBilling] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: ledgerData }, { data: billingData }] = await Promise.all([
      supabase
        .from("alternative_payment_ledger")
        .select("*, businesses(name, slug)")
        .order("marked_paid_at", { ascending: false })
        .limit(1000),
      supabase
        .from("monthly_platform_billing")
        .select("*, businesses(name)")
        .order("billing_month", { ascending: false })
        .limit(100),
    ]);
    setLedger((ledgerData as LedgerEntry[]) || []);
    setBilling((billingData as MonthlyBilling[]) || []);
    setLoading(false);
  }

  async function triggerManualBilling() {
    if (!confirm("This will charge all businesses for the previous month's alternative payments. Continue?")) return;
    setTriggeringBilling(true);
    setBillingMsg("");
    try {
      const res = await fetch("/api/cron/monthly-billing", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}` },
      });
      const data = await res.json();
      if (data.success) {
        setBillingMsg(`✅ Billing complete: ${data.charged} charged, ${data.failed} failed, ${data.noCard} no card on file.`);
        loadData();
      } else {
        setBillingMsg(`❌ Error: ${data.error}`);
      }
    } catch {
      setBillingMsg("❌ Network error. Please try again.");
    }
    setTriggeringBilling(false);
  }

  const filteredLedger = filterMonth
    ? ledger.filter((e) => e.billing_month === filterMonth)
    : ledger;

  const totalPendingFees = ledger
    .filter((e) => e.billing_status === "pending")
    .reduce((sum, e) => sum + e.platform_fee_cents, 0);

  const months = Array.from(new Set(ledger.map((e) => e.billing_month))).sort().reverse();

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      billed: "bg-green-100 text-green-800",
      charged: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      no_card: "bg-gray-100 text-gray-600",
    };
    return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alternative Payments</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Track Cash App and other non-credit-card payments. Platform fees are billed monthly.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Total Transactions</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{ledger.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Pending Fees</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">${(totalPendingFees / 100).toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Not yet billed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Total Collected</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            ${(ledger.filter(e => e.billing_status === "billed").reduce((s, e) => s + e.platform_fee_cents, 0) / 100).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">All time</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(["ledger", "billing"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "ledger" ? "Transaction Ledger" : "Monthly Billing"}
          </button>
        ))}
      </div>

      {activeTab === "ledger" && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
            >
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{filteredLedger.length} transactions</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Business</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Service</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Platform Fee</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Month</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLedger.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        No transactions found
                      </td>
                    </tr>
                  )}
                  {filteredLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {entry.businesses?.name ?? entry.business_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{entry.customer_name ?? "—"}</div>
                        {entry.customer_phone && (
                          <div className="text-xs text-gray-400">{entry.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{entry.service_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        ${((entry.service_amount_cents + entry.tip_cents) / 100).toFixed(2)}
                        {entry.tip_cents > 0 && (
                          <div className="text-xs text-gray-400">+${(entry.tip_cents / 100).toFixed(2)} tip</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">${(entry.platform_fee_cents / 100).toFixed(2)}</span>
                        <div className="text-xs text-gray-400">
                          {entry.fee_absorbed_by === "business" ? "business absorbs" : "customer paid"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {entry.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{entry.billing_month}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(entry.billing_status)}>{entry.billing_status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(entry.marked_paid_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "billing" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Monthly platform fee charges per business</p>
            <button
              onClick={triggerManualBilling}
              disabled={triggeringBilling}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-60 transition"
            >
              {triggeringBilling ? "Processing..." : "Run Billing Now"}
            </button>
          </div>
          {billingMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${billingMsg.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {billingMsg}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Business</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Month</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Transactions</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Fees</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Charged At</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {billing.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        No billing records yet
                      </td>
                    </tr>
                  )}
                  {billing.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {record.businesses?.name ?? record.business_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{record.billing_month}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{record.total_transactions}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ${(record.total_fees_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(record.status)}>{record.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {record.charged_at
                          ? new Date(record.charged_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {record.failure_reason ?? (record.stripe_charge_id ? `ch: ${record.stripe_charge_id.slice(0, 12)}...` : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
