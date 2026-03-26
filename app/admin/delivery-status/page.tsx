"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface MessageRecord {
  id: string;
  to_number: string;
  body: string;
  status: string;
  error_code: number | null;
  delivered_at: string | null;
  created_at: string;
}

interface BlockedNumber {
  normalized_phone: string;
  failure_count: number;
  last_failure_at: string | null;
  last_error_code: number | null;
  customerName?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  delivered:   "bg-green-100 text-green-800",
  sent:        "bg-blue-100 text-blue-800",
  queued:      "bg-gray-100 text-gray-700",
  accepted:    "bg-gray-100 text-gray-700",
  sending:     "bg-gray-100 text-gray-700",
  undelivered: "bg-orange-100 text-orange-800",
  failed:      "bg-red-100 text-red-800",
};

export default function DeliveryStatusPage() {
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessageRecord[]>([]);
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>([]);
  const [summary, setSummary] = useState({ delivered: 0, sent: 0, failed: 0, undelivered: 0, total: 0 });
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();
      if (biz) setBusinessId(biz.id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [{ data: messages }, { data: blocked }] = await Promise.all([
      supabase
        .from("sms_messages")
        .select("id, to_number, body, status, error_code, delivered_at, created_at")
        .eq("business_id", businessId)
        .eq("direction", "outbound")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("phone_health")
        .select("normalized_phone, failure_count, last_failure_at, last_error_code")
        .eq("send_blocked", true)
        .order("last_failure_at", { ascending: false }),
    ]);

    const msgs = (messages as MessageRecord[]) || [];
    setRecentMessages(msgs);

    const s = { delivered: 0, sent: 0, failed: 0, undelivered: 0, total: msgs.length };
    msgs.forEach(m => {
      if (m.status === "delivered") s.delivered++;
      else if (m.status === "sent") s.sent++;
      else if (m.status === "failed") s.failed++;
      else if (m.status === "undelivered") s.undelivered++;
    });
    setSummary(s);

    const blockedList = (blocked as BlockedNumber[]) || [];
    if (blockedList.length > 0) {
      const phones = blockedList.map(b => b.normalized_phone);
      const { data: customers } = await supabase
        .from("customers")
        .select("phone, full_name")
        .eq("business_id", businessId)
        .in("phone", phones);
      const nameMap = new Map(
        (customers || []).map((c: { phone: string; full_name: string | null }) => [c.phone, c.full_name])
      );
      setBlockedNumbers(blockedList.map(b => ({
        ...b,
        customerName: (nameMap.get(b.normalized_phone) as string | null) ?? null,
      })));
    } else {
      setBlockedNumbers([]);
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (businessId) loadStats();
  }, [businessId, loadStats]);

  const handleUnblock = async (phone: string) => {
    setUnblocking(phone);
    await fetch("/api/admin/unblock-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ normalized_phone: phone }),
    });
    setUnblocking(null);
    loadStats();
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/notifications"
            className="text-sm text-gray-500 hover:text-gray-700 font-medium mb-3 inline-block"
          >
            ← Back to Messages
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Delivery Status</h1>
              <p className="text-gray-500 mt-1">Last 7 days of outbound SMS</p>
            </div>
            <button
              onClick={loadStats}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Delivered",   value: summary.delivered,   color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
                { label: "In Transit",  value: summary.sent,        color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
                { label: "Undelivered", value: summary.undelivered, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
                { label: "Failed",      value: summary.failed,      color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200" },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl p-5 text-center`}>
                  <p className={`text-4xl font-bold ${color}`}>{value}</p>
                  <p className="text-sm text-gray-600 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Delivery Rate */}
            {summary.total > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Delivery Rate</h2>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-green-600">
                      {Math.round((summary.delivered / summary.total) * 100)}%
                    </span>
                    <span className="text-sm text-gray-400 ml-2">{summary.total} total sent</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${(summary.delivered / summary.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Blocked Numbers */}
            {blockedNumbers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-red-700 mb-1">
                  Blocked Numbers ({blockedNumbers.length})
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  These numbers are skipped on all future sends after 3+ delivery failures.
                </p>
                <div className="space-y-3">
                  {blockedNumbers.map(b => (
                    <div key={b.normalized_phone} className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {b.customerName || b.normalized_phone}
                        </p>
                        {b.customerName && <p className="text-xs text-gray-500 mt-0.5">{b.normalized_phone}</p>}
                        <p className="text-xs text-red-600 mt-1">
                          {b.failure_count} failure{b.failure_count !== 1 ? "s" : ""}
                          {b.last_failure_at && ` · Last failed ${new Date(b.last_failure_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnblock(b.normalized_phone)}
                        disabled={unblocking === b.normalized_phone}
                        className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                      >
                        {unblocking === b.normalized_phone ? "Unblocking..." : "Unblock"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Messages */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Recent Messages {recentMessages.length > 0 && `(${recentMessages.length})`}
              </h2>
              {recentMessages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages sent in the last 7 days</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentMessages.map(msg => (
                    <div key={msg.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{msg.to_number}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{msg.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.created_at).toLocaleString("en-US", {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                          {msg.error_code && (
                            <span className="text-red-500 ml-2">Error {msg.error_code}</span>
                          )}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[msg.status] || "bg-gray-100 text-gray-600"}`}>
                        {msg.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
