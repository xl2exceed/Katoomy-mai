// file: app/admin/recurring/page.tsx
// View and manage recurring booking schedules
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface RecurringSchedule {
  id: string;
  frequency: "weekly" | "biweekly" | "monthly";
  preferred_time: string;
  day_of_week: number;
  property_size: string | null;
  price_cents: number;
  status: "active" | "paused" | "cancelled";
  next_booking_date: string;
  last_booking_created_at: string | null;
  notes: string | null;
  created_at: string;
  customers: { id: string; full_name: string | null; phone: string | null } | null;
  services: { id: string; name: string } | null;
}

interface EditDraft {
  dayOfWeek: number;
  preferredTime: string;
  frequency: "weekly" | "biweekly" | "monthly";
}

const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};
const FREQ_COLORS: Record<string, string> = {
  weekly: "bg-green-100 text-green-800",
  biweekly: "bg-blue-100 text-blue-800",
  monthly: "bg-purple-100 text-purple-800",
};
const PROPERTY_LABELS: Record<string, string> = {
  small: "Small Yard",
  medium: "Medium Yard",
  large: "Large Yard",
  xl: "Acre+",
};

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function RecurringPage() {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "paused" | "cancelled" | "all">("active");
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const load = async (status: string) => {
    setLoading(true);
    const url = status === "all" ? "/api/recurring/list" : `/api/recurring/list?status=${status}`;
    const res = await fetch(url);
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setUpdating(id);
    const res = await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s));
    }
    setUpdating(null);
    return res.ok;
  };

  const startEdit = (s: RecurringSchedule) => {
    setEditingId(s.id);
    setEditDraft({ dayOfWeek: s.day_of_week, preferredTime: s.preferred_time, frequency: s.frequency });
  };

  const saveEdit = async (id: string) => {
    if (!editDraft) return;
    const ok = await patch(id, {
      dayOfWeek: editDraft.dayOfWeek,
      preferredTime: editDraft.preferredTime,
      frequency: editDraft.frequency,
    });
    if (ok) setEditingId(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔄</span>
            <h1 className="text-2xl font-bold text-gray-900">Recurring Schedules</h1>
          </div>
          <p className="text-sm text-gray-500">Customers on automatic repeat bookings. Bookings are auto-created 3 days in advance.</p>
        </div>
        <Link href="/admin/lawncare" className="text-sm text-gray-400 hover:text-gray-600">
          ← Lawn Care Settings
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["active", "paused", "cancelled", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition ${
              filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">🌿</p>
          <p className="font-semibold text-gray-700">No {filter === "all" ? "" : filter} recurring schedules yet</p>
          <p className="text-sm text-gray-400 mt-1">Customers can set up recurring bookings when they book a lawn care service.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Customer + service */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <p className="font-bold text-gray-900">{s.customers?.full_name ?? "Unknown"}</p>
                    {s.customers?.phone && (
                      <span className="text-xs text-gray-400">{s.customers.phone}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{s.services?.name ?? "—"}</p>

                  {/* Tags row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${FREQ_COLORS[s.frequency]}`}>
                      {FREQ_LABELS[s.frequency]}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      {DAYS[s.day_of_week]}s at {formatTime(s.preferred_time)}
                    </span>
                    {s.property_size && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                        {PROPERTY_LABELS[s.property_size] ?? s.property_size}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500">
                      ${(s.price_cents / 100).toFixed(2)}/visit
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      s.status === "active" ? "bg-green-50 text-green-700" :
                      s.status === "paused" ? "bg-yellow-50 text-yellow-700" :
                      "bg-red-50 text-red-600"
                    }`}>
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </div>

                  {/* Next booking */}
                  <p className="text-xs text-gray-400 mt-3">
                    Next booking: <span className="font-semibold text-gray-600">{formatDate(s.next_booking_date)}</span>
                    {s.last_booking_created_at && (
                      <> · Last created: {new Date(s.last_booking_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                    )}
                  </p>
                </div>

                {/* Actions */}
                {s.status !== "cancelled" && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => editingId === s.id ? setEditingId(null) : startEdit(s)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition"
                    >
                      {editingId === s.id ? "Cancel Edit" : "✏️ Reschedule"}
                    </button>
                    {s.status === "active" && (
                      <button
                        onClick={() => patch(s.id, { status: "paused" })}
                        disabled={updating === s.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 disabled:opacity-40 transition"
                      >
                        Pause
                      </button>
                    )}
                    {s.status === "paused" && (
                      <button
                        onClick={() => patch(s.id, { status: "active" })}
                        disabled={updating === s.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 transition"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => patch(s.id, { status: "cancelled" })}
                      disabled={updating === s.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Inline reschedule form */}
              {editingId === s.id && editDraft && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Reschedule</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Day of week */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Day of Week</label>
                      <select
                        value={editDraft.dayOfWeek}
                        onChange={(e) => setEditDraft((d) => d ? { ...d, dayOfWeek: Number(e.target.value) } : d)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {DAYS_FULL.map((day, i) => (
                          <option key={i} value={i}>{day}</option>
                        ))}
                      </select>
                    </div>

                    {/* Time */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Preferred Time</label>
                      <input
                        type="time"
                        value={editDraft.preferredTime}
                        onChange={(e) => setEditDraft((d) => d ? { ...d, preferredTime: e.target.value } : d)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Frequency</label>
                      <select
                        value={editDraft.frequency}
                        onChange={(e) => setEditDraft((d) => d ? { ...d, frequency: e.target.value as "weekly" | "biweekly" | "monthly" } : d)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 Weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={updating === s.id}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
                    >
                      {updating === s.id ? "Saving…" : "Save Changes"}
                    </button>
                    <p className="text-xs text-gray-400">
                      Next booking will be recalculated to the next {DAYS_FULL[editDraft.dayOfWeek]}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
