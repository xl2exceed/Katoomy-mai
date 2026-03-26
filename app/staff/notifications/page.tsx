"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

interface Booking {
  id: string;
  start_ts: string;
  status: string;
  created_at: string;
  customers: { full_name: string | null; phone: string };
  services: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  requested: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  incomplete: "bg-orange-100 text-orange-700",
};

const STATUS_ICONS: Record<string, string> = {
  confirmed: "✅",
  requested: "🔔",
  completed: "✓",
  cancelled: "✗",
  no_show: "⚠️",
  incomplete: "⏳",
};

export default function StaffNotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [newRequests, setNewRequests] = useState<Booking[]>([]);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/staff/login"); return; }

    const { data: s } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!s) { router.push("/staff/login"); return; }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data } = await supabase
      .from("bookings")
      .select("id, start_ts, status, created_at, customers(full_name, phone), services(name)")
      .eq("staff_id", s.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    const bookings = (data as Booking[]) || [];
    setNewRequests(bookings.filter((b) => b.status === "requested"));
    setRecent(bookings.filter((b) => b.status !== "requested"));
    setLoading(false);
  }

  const formatRelative = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-gray-900">
            {booking.customers.full_name || "Guest"}
          </p>
          <p className="text-sm text-gray-500">{formatPhone(booking.customers.phone)}</p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-600"}`}>
            {STATUS_ICONS[booking.status]} {booking.status.replace("_", " ")}
          </span>
          <p className="text-xs text-gray-400 mt-1">{formatRelative(booking.created_at)}</p>
        </div>
      </div>
      <div className="text-sm text-gray-600">
        {booking.services?.name && <span>{booking.services.name} · </span>}
        <span>
          {new Date(booking.start_ts).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric",
          })}{" "}
          {new Date(booking.start_ts).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">
        Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Notifications</h1>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        </div>
      ) : (
        <>
          {newRequests.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold text-gray-900">New Requests</h2>
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {newRequests.length}
                </span>
              </div>
              <div className="space-y-3">
                {newRequests.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              Recent Activity <span className="text-gray-400 font-normal text-sm">(last 30 days)</span>
            </h2>
            {recent.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl">
                <p className="text-gray-500">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            )}
          </div>

          {newRequests.length === 0 && recent.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-3xl mb-2">🔔</p>
              <p className="text-gray-500">No notifications yet</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
