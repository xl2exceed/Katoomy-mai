"use client";

import { formatPhone } from "@/lib/utils/formatPhone";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { sendPush } from "@/lib/utils/sendPush";
import PaymentNotificationBanner from "@/components/PaymentNotificationBanner";
import Pagination from "@/components/Pagination";

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
  vehicle_type: string | null;
  vehicle_condition: string | null;
  customer_address: string | null;
  addon_ids: string[] | null;
  customers: {
    full_name: string | null;
    phone: string;
  } | null;
  staff: { full_name: string } | null;
  services: { name: string } | null;
}

const VEHICLE_LABELS: Record<string, string> = {
  sedan: "Sedan / Coupe",
  suv: "SUV / Crossover",
  truck: "Truck / Pickup",
  van: "Van / Minivan",
  other: "Other Vehicle",
};

export default function MobileSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [niche, setNiche] = useState("barber");
  const [addonsMap, setAddonsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("adminScheduleDate");
      if (saved) return new Date(saved);
    }
    return new Date();
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [businessSlug, setBusinessSlug] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [feeMode, setFeeMode] = useState<string>("pass_to_customer");

  const supabase = createClient();

  const platformFee = feeMode === "pass_to_customer" ? 100 : 0;

  const paymentBadge = (booking: Booking) => {
    const total = booking.total_price_cents;
    const deposit = booking.deposit_amount_cents ?? 0;
    if (["paid", "cash_paid"].includes(booking.payment_status)) {
      return { text: `Paid in full ($${(total / 100).toFixed(2)})`, color: "bg-green-100 border-green-500 text-green-800" };
    }
    if (booking.payment_status === "deposit_paid") {
      return { text: `Deposit paid — bal: $${((total + platformFee - deposit) / 100).toFixed(2)}`, color: "bg-yellow-100 border-yellow-500 text-yellow-800" };
    }
    if (booking.payment_status === "refunded") {
      return { text: "Refunded", color: "bg-gray-100 border-gray-400 text-gray-700" };
    }
    if (booking.payment_status === "custom_paid") {
      return { text: "Custom — paid (see ledger)", color: "bg-green-100 border-green-500 text-green-800" };
    }
    if (booking.status === "custom") {
      return { text: "Custom — payment pending", color: "bg-purple-100 border-purple-400 text-purple-800" };
    }
    if (booking.status === "completed") {
      return { text: `Owes $${((total + platformFee) / 100).toFixed(2)}`, color: "bg-orange-100 border-orange-500 text-orange-800" };
    }
    return null;
  };

  useEffect(() => {
    sessionStorage.setItem("adminScheduleDate", selectedDate.toISOString());
  }, [selectedDate]);

  // Real-time: reload when any booking's payment_status changes from another portal
  useEffect(() => {
    const channel = supabase
      .channel("admin-mobile-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        loadBookings();
      })
      .subscribe();
    // BroadcastChannel: reload instantly when a custom payment is recorded from the Take Payment page
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("katoomy-booking-update");
      bc.onmessage = () => { loadBookings(); };
    } catch { /* not supported */ }
    return () => {
      supabase.removeChannel(channel);
      bc?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, view]);

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, view]);

  const loadBookings = async () => {
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(selectedDate);
    if (view === "week") {
      endDate.setDate(endDate.getDate() + 7);
    } else {
      endDate.setDate(endDate.getDate() + 1);
    }
    endDate.setHours(0, 0, 0, 0);

    const res = await fetch(
      `/api/admin/schedule-bookings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings || []);
      setBusinessSlug(data.slug || "");
      setBusinessId(data.businessId || "");
      if (data.niche) setNiche(data.niche);
      if (data.addonsMap) setAddonsMap(data.addonsMap);

      // Fetch fee_mode for display
      if (data.businessId) {
        const { data: cashSettings } = await supabase
          .from("cashapp_settings")
          .select("fee_mode")
          .eq("business_id", data.businessId)
          .maybeSingle();
        setFeeMode(cashSettings?.fee_mode ?? "pass_to_customer");
      }
    }
    setLoading(false);
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - (view === "week" ? 7 : 1));
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (view === "week" ? 7 : 1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const handleComplete = async (bookingId: string) => {
    const { data: booking } = await supabase
      .from("bookings")
      .select("business_id, customer_id, payment_status, total_price_cents, deposit_amount_cents, customers(phone)")
      .eq("id", bookingId)
      .maybeSingle();

    await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    if (booking) {
      const isPaid = ["paid", "cash_paid"].includes(booking.payment_status ?? "");
      const { data: loyaltySettings } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("business_id", booking.business_id)
        .single();

      if (isPaid && loyaltySettings?.enabled && loyaltySettings.earn_on_completion) {
        const { data: existingPoints } = await supabase
          .from("loyalty_ledger")
          .select("id, slug")
          .eq("related_booking_id", bookingId)
          .eq("event_type", "completion")
          .single();

        if (!existingPoints) {
          await supabase.from("loyalty_ledger").insert({
            business_id: booking.business_id,
            customer_id: booking.customer_id,
            event_type: "completion",
            points_delta: loyaltySettings.points_per_event,
            related_booking_id: bookingId,
          });
        }
      }
    }

    // Push notification to customer to open app and pay/tip
    if (booking) {
      const isUnpaid = booking.payment_status === "unpaid";
      await sendPush("customer", booking.customer_id, {
        title: "Appointment Complete!",
        body: isUnpaid
          ? "Your appointment is done. Open the app to complete your payment."
          : "Thanks for your visit! Open the app to leave a tip.",
        url: `/${businessSlug}/dashboard`,
      });

    }

    loadBookings();
  };

  const handleMarkPaid = async (booking: Booking) => {
    await fetch("/api/admin/mark-booking-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    await sendPush("customer", booking.customer_id, {
      title: "Payment Received",
      body: "Your payment has been recorded. Thank you!",
      url: `/${businessSlug}/dashboard`,
    });

    loadBookings();
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    if (newStatus === "cancelled") {
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking) {
        setSelectedBooking(booking);
        setCancelModalOpen(true);
      }
      return;
    }

    if (newStatus === "completed") {
      await handleComplete(bookingId);
      return;
    }

    // Optimistic update so the card changes instantly
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: newStatus } : b));

    await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", bookingId);
  };

  const handleCancelClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return;
    setCancelling(true);

    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", selectedBooking.id);

    // Notify customer
    const apptTime = new Date(selectedBooking.start_ts).toLocaleString(
      "en-US",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
    );
    await sendPush("customer", selectedBooking.customer_id, {
      title: "Appointment Cancelled",
      body: `Your appointment on ${apptTime} has been cancelled. Please contact us to rebook.`,
      url: `/${businessSlug}/notifications`,
    });

    setCancelling(false);
    setCancelModalOpen(false);
    setSelectedBooking(null);
    loadBookings();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link
        href="/admin/mobile/menu"
        className="text-blue-600 hover:text-blue-700 font-medium mb-4 block"
      >
        ← Back to Menu
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">Schedule</h1>

      {/* Date Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goToPreviousDay}
            className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium"
          >
            ← {view === "week" ? "Week" : "Day"}
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold"
          >
            Today
          </button>
          <button
            onClick={goToNextDay}
            className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium"
          >
            {view === "week" ? "Week" : "Day"} →
          </button>
        </div>

        <p className="text-center font-semibold text-gray-900">
          {formatDate(selectedDate)}
          {view === "week" &&
            " - " +
              formatDate(
                new Date(selectedDate.getTime() + 6 * 24 * 60 * 60 * 1000),
              )}
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setView("day")}
          className={`flex-1 py-3 rounded-xl font-semibold transition ${
            view === "day"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white text-gray-700 border-2 border-gray-200"
          }`}
        >
          Day View
        </button>
        <button
          onClick={() => setView("week")}
          className={`flex-1 py-3 rounded-xl font-semibold transition ${
            view === "week"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white text-gray-700 border-2 border-gray-200"
          }`}
        >
          Week View
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 text-base"
        >
          <option value="all">All Appointments</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
          <option value="incomplete">Incomplete</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (() => {
        const filtered = bookings.filter((b) => statusFilter === "all" || b.status === statusFilter);
        const paged = filtered.slice((page - 1) * perPage, page * perPage);
        if (filtered.length === 0) return (
          <div className="text-center py-12 bg-white rounded-xl p-8">
            <p className="text-gray-500 text-lg">No appointments found</p>
          </div>
        );
        return (
        <div className="space-y-3">
          {paged.map((booking) => (
              <div
                key={booking.id}
                className="bg-blue-50 p-4 rounded-xl shadow border-2 border-blue-500"
              >
                {view === "week" && (
                  <p className="text-xs font-semibold text-blue-600 mb-1">
                    {new Date(booking.start_ts).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xl font-bold text-gray-900">
                    {new Date(booking.start_ts).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {(() => { const badge = paymentBadge(booking); return badge ? (
                    <div className={`flex items-center border rounded-lg px-2 py-1 ${badge.color}`}>
                      <p className="text-xs font-semibold leading-tight">{badge.text}</p>
                    </div>
                  ) : null; })()}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-base font-semibold text-gray-900">
                    {booking.customers?.full_name || "Guest"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatPhone(booking.customers?.phone)}
                  </p>
                  {booking.services?.name && (
                    <p className="text-sm text-gray-700 mt-0.5">
                      {booking.services.name}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-0.5">
                    With: {booking.staff?.full_name || "No Preference"}
                  </p>
                  {niche === "carwash" && booking.vehicle_type && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                      <p className="text-xs font-semibold text-blue-700">
                        🚗 {VEHICLE_LABELS[booking.vehicle_type] || booking.vehicle_type}
                        {booking.vehicle_condition && (
                          <span className="ml-2 font-normal text-blue-600">
                            — {booking.vehicle_condition === "heavy" ? "Heavily Soiled" : "Lightly Soiled"}
                          </span>
                        )}
                      </p>
                      {booking.customer_address && (
                        <p className="text-xs text-blue-700">📍 {booking.customer_address}</p>
                      )}
                      {booking.addon_ids && booking.addon_ids.length > 0 && (
                        <p className="text-xs text-blue-700">
                          ✅ {booking.addon_ids.map((id) => addonsMap[id] || "Add-on").join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  {booking.customer_notes && (
                    <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-yellow-700 mb-0.5">Customer Note</p>
                      <p className="text-sm text-yellow-900">{booking.customer_notes}</p>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">
                    {booking.status.replace("_", " ")}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ${((booking.total_price_cents + platformFee) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="mt-3">
                  <select
                    value={booking.status}
                    onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl bg-white text-gray-900 text-sm font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="requested">Requested</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {["completed", "custom"].includes(booking.status) &&
                  !["paid", "cash_paid", "custom_paid", "refunded"].includes(booking.payment_status) && (
                    <Link
                      href={`/admin/mobile/take-payment?phone=${booking.customers?.phone || ""}`}
                      className="mt-3 block w-full py-3 bg-emerald-600 text-white rounded-xl font-bold active:scale-95 transition shadow text-center"
                    >
                      💳 Take A Payment
                    </Link>
                  )}
              </div>
            ))}
          <Pagination mobile
            total={filtered.length} perPage={perPage} page={page}
            onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          />
        </div>
        );
      })()}

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Cancel Appointment?
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-semibold text-gray-900">
                {selectedBooking.customers?.full_name || "Guest"}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(selectedBooking.start_ts).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-2">
                ${((selectedBooking.total_price_cents + platformFee) / 100).toFixed(2)}
              </p>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              The customer will be notified by push notification.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setSelectedBooking(null);
                }}
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
      {businessId && (
        <PaymentNotificationBanner businessId={businessId} supabase={supabase} onRespond={loadBookings} />
      )}
    </div>
  );
}
