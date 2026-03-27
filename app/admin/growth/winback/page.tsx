"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  last_visit_at: string | null;
}

interface WinbackData {
  customers: Customer[];
  total: number;
  inactiveDays: number;
}

export default function WinbackPage() {
  const [data, setData] = useState<WinbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/growth/winback")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.customers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.customers.map((c) => c.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const sendWinback = async () => {
    if (!selected.size) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/growth/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      setResult(json);
      setSelected(new Set());
      // Reload list
      const fresh = await fetch("/api/growth/winback").then((r) => r.json());
      setData(fresh);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  };

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return `${days} days ago`;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">💌</span>
            <h1 className="text-2xl font-bold text-gray-900">Win-Back Campaigns</h1>
          </div>
          <p className="text-sm text-gray-500">
            Customers who haven&apos;t booked in{" "}
            <strong>{data?.inactiveDays ?? "…"} days</strong> or more.
            Send them a personalized text to bring them back.
          </p>
        </div>
        <Link
          href="/admin/growth/settings"
          className="text-xs text-indigo-600 underline underline-offset-2"
        >
          Adjust settings
        </Link>
      </div>

      {/* Result Banner */}
      {result && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 font-semibold text-sm">
            ✅ Sent {result.sent} win-back text{result.sent !== 1 ? "s" : ""}
            {result.failed > 0 && ` · ${result.failed} failed`}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data?.customers.length ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-700 font-semibold">No inactive customers right now</p>
          <p className="text-gray-500 text-sm mt-1">
            All your customers have booked within the last {data?.inactiveDays ?? 60} days.
          </p>
        </div>
      ) : (
        <>
          {/* Action Bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === data.customers.length && data.customers.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-purple-600"
              />
              <span className="text-sm text-gray-600">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${data.total} eligible customers`}
              </span>
            </div>
            <button
              onClick={sendWinback}
              disabled={!selected.size || sending}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40 transition"
            >
              {sending ? "Sending…" : `Send Win-Back Text (${selected.size})`}
            </button>
          </div>

          {/* Customer List */}
          <div className="space-y-2">
            {data.customers.map((c) => (
              <div
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition ${
                  selected.has(c.id)
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-100 bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded accent-purple-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {c.full_name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Last visit</p>
                  <p className="text-xs font-semibold text-gray-700">{daysSince(c.last_visit_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin/growth" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to AI Growth Hub
        </Link>
      </div>
    </div>
  );
}
