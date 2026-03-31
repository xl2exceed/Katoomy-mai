"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";
import { sendPush } from "@/lib/utils/sendPush";

interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  start_ts: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
  deposit_amount_cents: number | null;
  customer_notes: string | null;
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

export default function StaffSchedulePage() {
  const router = useRouter();
  const supabase = createClient();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("staffScheduleDate");
      if (saved) return new Date(saved);
    }
    return new Date();
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const paymentBadge = (booking: Booking) => {
    const total = booking.total_price_cents;
    const deposit = booking.deposit_amount_cents ?? 0;
    if (["paid", "cash_paid"].includes(booking.payment_status)) {
      return { text: `Paid in full ($${(total / 100).toFixed(2)})`, color: "bg-green-100 border-green-500 text-green-800" };
    }
    if (booking.payment_status === "deposit_paid") {
      return { text: `Deposit paid — bal: $${((total - deposit) / 100).toFixed(2)}`, color: "bg-yellow-100 border-yellow-500 text-yellow-800" };
    }
    if (booking.payment_status === "refunded") {
      return { text: "Refunded", color: "bg-gray-100 border-gray-400 text-gray-700" };
    }
    if (booking.status === "completed") {
      return { text: `Owes $${(total / 100).toFixed(2)}`, color: "bg-orange-100 border-orange-500 text-orange-800" };
    }
    return null;
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sessionStorage.setItem("staffScheduleDate", selectedDate.toISOString());
  }, [selectedDate]);

  useEffect(() => {
    if (staffId) loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, selectedDate, view]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/staff/login"); return; }

    const { data: s } = await supabase
      .from("staff")
      .select("id, business_id, businesses(slug)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!s) { router.push("/staff/login"); return; }
    const slug = (s.businesses as unknown as { slug: string } | null)?.slug || "";
    setBusinessSlug(slug);
    setStaffId(s.id);
  }

  async function loadBookings() {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    if (view === "week") end.setDate(end.getDate() + 7);
    else end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("bookings")
      .select("id, customer_id, business_id, start_ts, status, payment_status, total_price_cents, deposit_amount_cents, customer_notes, customers(full_name, phone), services(name)")
      .eq("staff_id", staffId)
      .gte("start_ts", start.toISOString())
      .lt("start_ts", end.toISOString())
      .order("start_ts", { ascending: true });

    setBookings((data as Booking[]) || []);
    setLoading(false);
  }

  // Route all booking updates through the server-side admin API to avoid RLS issues
  const updateBooking = async (bookingId: string, updates: { status?: string; payment_status?: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/staff/update-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ bookingId, staffId, ...updates }),
    });
  };

  const handleComplete = async (bookingId: string) => {
    const { data: booking } = await supabase
      .from("bookings")
      .select("business_id, customer_id, payment_status, total_price_cents, deposit_amount_cents")
      .eq("id", bookingId)
      .maybeSingle();

    await updateBooking(bookingId, { status: "completed" });

    if (booking) {
      await sendPush("customer", booking.customer_id, {
        title: "Appointment Complete!",
        body: booking.payment_status === "unpaid"
          ? "Your appointment is done. Open the app to complete your payment."
          : "Thanks for your visit! Open the app to leave a tip.",
        url: `/${businessSlug}/dashboard`,
      });
    }
    loadBookings();
  };

  const handleMarkPaid = async (booking: Booking) => {
    await updateBooking(booking.id, { payment_status: "paid" });
    await sendPush("customer", booking.customer_id, {
      title: "Payment Received",
      body: "Your payment has been recorded. Thank you!",
      url: `/${businessSlug}/dashboard`,
    });
    loadBookings();
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    if (newStatus === "cancelled") {
      const b = bookings.find((b) => b.id === bookingId);
      if (b) { setSelectedBooking(b); setCancelModalOpen(true); }
      return;
    }
    if (newStatus === "completed") { await handleComplete(bookingId); return; }
    await updateBooking(bookingId, { status: newStatus });
    loadBookings();
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return;
    setCancelling(true);
    await updateBooking(selectedBooking.id, { status: "cancelled" });
    const apptTime = new Date(selectedBooking.start_ts).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    await sendPush("customer", selectedBooking.customer_id, {
      title: "Appointment Cancelled",
      body: `Your appointment on ${apptTime} has been cancelled.`,
      url: `/${businessSlug}/notifications`,
    });
    setCancelling(false);
    setCancelModalOpen(false);
    setSelectedBooking(null);
    loadBookings();
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const filtered = bookings.filter((b) => statusFilter === "all" || b.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">
        Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My Schedule</h1>

      {/* Date Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - (view === "week" ? 7 : 1));
              setSelectedDate(d);
            }}
            className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium"
          >
            {view === "week" ? "← Week" : "← Day"}
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + (view === "week" ? 7 : 1));
              setSelectedDate(d);
            }}
            className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium"
          >
            {view === "week" ? "Week →" : "Day →"}
          </button>
        </div>
        <p className="text-center font-semibold text-gray-900">
          {formatDate(selectedDate)}
          {view === "week" &&
            " – " + formatDate(new Date(selectedDate.getTime() + 6 * 86400000))}
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-4">
        {(["day", "week"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-3 rounded-xl font-semibold transition ${
              view === v
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white text-gray-700 border-2 border-gray-200"
            }`}
          >
            {v === "day" ? "Day View" : "Week View"}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-emerald-500 text-base"
        >
          <option value="all">All Appointments</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl p-8">
          <p className="text-gray-500 text-lg">No appointments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div key={booking.id} className="bg-white p-4 rounded-xl shadow border border-gray-200">
              {view === "week" && (
                <p className="text-xs font-semibold text-emerald-600 mb-1">
                  {new Date(booking.start_ts).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                </p>
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-bold text-gray-900">
                  {new Date(booking.start_ts).toLocaleTimeString("en-US", {
                    hour: "numeric", minute: "2-digit",
                  })}
                </p>
                {(() => { const badge = paymentBadge(booking); return badge ? (
                  <div className={`flex items-center border rounded-lg px-2 py-1 ${badge.color}`}>
                    <p className="text-xs font-semibold">{badge.text}</p>
                  </div>
                ) : null; })()}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-base font-semibold text-gray-900">
                  {booking.customers.full_name || "Guest"}
                </p>
                <p className="text-sm text-gray-600">{formatPhone(booking.customers.phone)}</p>
                {booking.services?.name && (
                  <p className="text-sm text-gray-700 mt-0.5">{booking.services.name}</p>
                )}
                {booking.customer_notes && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-yellow-700 mb-0.5">Customer Note</p>
                    <p className="text-sm text-yellow-900">{booking.customer_notes}</p>
                  </div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-start">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {booking.status.replace("_", " ")}
                </span>
                {booking.payment_status === "deposit_paid" ? (
                  <div className="text-right">
                    <span className="text-lg font-bold text-orange-600">
                      ${((booking.total_price_cents - (booking.deposit_amount_cents ?? 0)) / 100).toFixed(2)} due
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Deposit paid: ${((booking.deposit_amount_cents ?? 0) / 100).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-gray-900">
                    ${(booking.total_price_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <select
                  value={booking.status}
                  onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl bg-white text-gray-900 text-sm font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="requested">Requested</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
              {booking.status === "completed" && !["paid", "cash_paid"].includes(booking.payment_status) && (
                <button
                  onClick={() => handleMarkPaid(booking)}
                  className="mt-3 w-full py-3 bg-emerald-600 text-white rounded-xl font-bold active:scale-95 transition shadow"
                >
                  Mark Paid (Cash)
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Cancel Appointment?</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-semibold text-gray-900">
                {selectedBooking.customers.full_name || "Guest"}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(selectedBooking.start_ts).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </p>
            </div>
            <p className="text-gray-600 text-sm mb-6">The customer will be notified.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModalOpen(false); setSelectedBooking(null); }}
                disabled={cancelling}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold disabled:opacity-50"
              >
                Keep It
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
