// file: app/admin/bookings/page.tsx

"use client";

import { formatPhone } from "@/lib/utils/formatPhone";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendPush } from "@/lib/utils/sendPush";

interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  start_ts: string;
  end_ts: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
  deposit_amount_cents: number | null;
  customers: {
    full_name: string | null;
    phone: string;
    email: string | null;
  };
  services: {
    name: string;
    duration_minutes: number;
  };
  customer_notes: string | null;
  staff: {
    full_name: string;
  } | null;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Refund modal state
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("requested_by_customer");
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, view]);

  const loadBookings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedDate);
      if (view === "week") {
        endDate.setDate(endDate.getDate() + 7);
      } else {
        endDate.setDate(endDate.getDate() + 1);
      }
      endDate.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("bookings")
        .select(
          "id, customer_id, business_id, start_ts, end_ts, status, payment_status, total_price_cents, deposit_amount_cents, customer_notes, customers(full_name, phone, email), services(name, duration_minutes), staff(full_name)",
        )
        .eq("business_id", business.id)
        .gte("start_ts", startDate.toISOString())
        .lt("start_ts", endDate.toISOString())
        .order("start_ts", { ascending: true });

      setBookings((data as Booking[]) || []);
    }

    setLoading(false);
  };

  const handleRefundSubmit = async () => {
    if (!refundBooking) return;
    setRefunding(true);
    setRefundError("");
    setRefundSuccess("");

    const body: { bookingId: string; reason: string; amountCents?: number } = {
      bookingId: refundBooking.id,
      reason: refundReason,
    };

    if (refundType === "partial") {
      const cents = Math.round(parseFloat(refundAmount) * 100);
      if (!cents || cents <= 0) {
        setRefundError("Enter a valid refund amount.");
        setRefunding(false);
        return;
      }
      if (cents > refundBooking.total_price_cents) {
        setRefundError(`Cannot exceed $${(refundBooking.total_price_cents / 100).toFixed(2)}.`);
        setRefunding(false);
        return;
      }
      body.amountCents = cents;
    }

    const res = await fetch("/api/stripe/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setRefundError(data.error || "Refund failed.");
    } else {
      const amt = (data.amountCents / 100).toFixed(2);
      setRefundSuccess(`Refund of $${amt} issued successfully.`);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === refundBooking.id
            ? { ...b, payment_status: data.amountCents >= refundBooking.total_price_cents ? "refunded" : b.payment_status }
            : b
        )
      );
    }
    setRefunding(false);
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    // Optimistically update UI immediately
    setBookings((prevBookings) =>
      prevBookings.map((booking) =>
        booking.id === bookingId ? { ...booking, status: newStatus } : booking,
      ),
    );

    try {
      // Get the booking details first
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, business_id, customer_id, payment_status, customers(phone)")
        .eq("id", bookingId)
        .single();

      // Update booking status
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating status:", error);
        loadBookings();
        return;
      }

      // Find the booking in state to get customer info
      const bookingData = bookings.find((b) => b.id === bookingId);
      const apptTime = bookingData
        ? new Date(bookingData.start_ts).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "";

      // Get business slug for notification URL
      const { data: bizSlug } = await supabase
        .from("businesses")
        .select("slug")
        .eq("id", booking?.business_id)
        .single();

      const slug = bizSlug?.slug || "";

      // Notify customer when owner cancels or confirms
      if (booking && bookingData) {
        if (newStatus === "cancelled") {
          await sendPush("customer", booking.customer_id, {
            title: "Appointment Cancelled",
            body: `Your appointment on ${apptTime} has been cancelled. Please contact us to rebook.`,
            url: `/${slug}/notifications`,
          });
        } else if (newStatus === "confirmed") {
          await sendPush("customer", booking.customer_id, {
            title: "Appointment Confirmed ✅",
            body: `Your appointment on ${apptTime} is confirmed. See you then!`,
            url: `/${slug}/notifications`,
          });
        }
      }

      // Award loyalty points only when completed AND payment has been collected
      const isPaid = ["paid", "cash_paid"].includes(booking?.payment_status ?? "");
      if (newStatus === "completed" && booking && isPaid) {
        // Get loyalty settings
        const { data: loyaltySettings } = await supabase
          .from("loyalty_settings")
          .select("*")
          .eq("business_id", booking.business_id)
          .single();

        if (loyaltySettings?.enabled && loyaltySettings.earn_on_completion) {
          // Check if points already awarded
          const { data: existingPoints } = await supabase
            .from("loyalty_ledger")
            .select("id")
            .eq("related_booking_id", bookingId)
            .eq("event_type", "completion")
            .maybeSingle();

          // Award points if not already awarded
          if (!existingPoints) {
            await supabase.from("loyalty_ledger").insert({
              business_id: booking.business_id,
              customer_id: booking.customer_id,
              event_type: "completion",
              points_delta: loyaltySettings.points_per_event,
              related_booking_id: bookingId,
            });

            console.log("✅ Loyalty points awarded!");
          }
        }

        // Check if referral program is enabled
        const { data: referralSettings } = await supabase
          .from("loyalty_settings")
          .select("referral_enabled, referrer_reward_points")
          .eq("business_id", booking.business_id)
          .single();

        // Award referral points if this was a referral AND referral program is enabled
        if (referralSettings?.referral_enabled !== false) {
          const { data: referralRecord } = await supabase
            .from("referrals")
            .select("id, referrer_customer_id")
            .eq("business_id", booking.business_id)
            .eq("referred_customer_id", booking.customer_id)
            .eq("status", "pending")
            .maybeSingle();

          if (referralRecord) {
            const referrerPoints =
              referralSettings?.referrer_reward_points ?? 15;

            // Award points to the referrer
            await supabase.from("loyalty_ledger").insert({
              business_id: booking.business_id,
              customer_id: referralRecord.referrer_customer_id,
              points_delta: referrerPoints,
              event_type: "referral",
              related_booking_id: bookingId,
            });

            // Update referral status to completed
            await supabase
              .from("referrals")
              .update({
                status: "completed",
                reward_points_awarded: referrerPoints,
                first_completed_booking_id: bookingId,
                completed_at: new Date().toISOString(),
              })
              .eq("id", referralRecord.id);

            console.log(
              "🎉 Referral reward awarded:",
              referrerPoints,
              "points",
            );
          }
        }

        // Push notification to customer to open app and pay/tip
        const isUnpaid = booking.payment_status === "unpaid";
        await sendPush("customer", booking.customer_id, {
          title: "Appointment Complete!",
          body: isUnpaid
            ? "Your appointment is done. Open the app to complete your payment."
            : "Thanks for your visit! Open the app to leave a tip.",
          url: `/${slug}/dashboard`,
        });
      }
    } catch (error) {
      console.error("Error in handleStatusChange:", error);
      // Reload bookings to ensure UI matches database
      loadBookings();
    }
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
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const paymentBadge = (booking: Booking) => {
    const total = booking.total_price_cents;
    if (["paid", "cash_paid"].includes(booking.payment_status)) {
      return { text: `Paid in full ($${(total / 100).toFixed(2)})`, color: "bg-green-100 border-green-500 text-green-800" };
    }
    if (booking.payment_status === "deposit_paid") {
      const deposit = booking.deposit_amount_cents ?? 0;
      return { text: `Deposit paid — bal: $${((total - deposit) / 100).toFixed(2)}`, color: "bg-yellow-100 border-yellow-500 text-yellow-800" };
    }
    if (booking.payment_status === "refunded") {
      return null; // shown via separate "Refunded" badge
    }
    if (booking.status === "completed") {
      return { text: `Owes $${(total / 100).toFixed(2)}`, color: "bg-orange-100 border-orange-500 text-orange-800" };
    }
    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "no_show":
        return "bg-gray-100 text-gray-700";
      case "incomplete":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  My Schedule
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage your appointments and availability
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={goToPreviousDay}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  ← Previous
                </button>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition"
                >
                  Today
                </button>
                <button
                  onClick={goToNextDay}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  Next →
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">
                    Filter:
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setView("day")}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      view === "day"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => setView("week")}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      view === "week"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Week
                  </button>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900">
              {formatDate(selectedDate)}
              {view === "week" &&
                " - " +
                  formatDate(
                    new Date(selectedDate.getTime() + 6 * 24 * 60 * 60 * 1000),
                  )}
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No appointments scheduled
              </h3>
              <p className="text-gray-600">
                {view === "day"
                  ? "No bookings for this day"
                  : "No bookings for this week"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings
                .filter((booking) => {
                  if (statusFilter === "all") return true;
                  return booking.status === statusFilter;
                })
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="text-center min-w-[80px]">
                          {view === "week" && (
                            <p className="text-xs font-semibold text-blue-600 mb-1">
                              {new Date(booking.start_ts).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          )}
                          <p className="text-2xl font-bold text-gray-900">
                            {new Date(booking.start_ts).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {booking.services.duration_minutes} min
                          </p>
                        </div>

                        <div className="h-16 w-px bg-gray-200"></div>

                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {booking.services.name}
                          </h3>
                          <p className="text-gray-600">
                            {booking.customers.full_name || "Customer"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatPhone(booking.customers.phone)}
                            {booking.customers.email &&
                              ` • ${booking.customers.email}`}
                          </p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            With: {booking.staff?.full_name || "No Preference"}
                          </p>
                          {booking.customer_notes && (
                            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-yellow-700 mb-0.5">Customer Note</p>
                              <p className="text-sm text-yellow-900">{booking.customer_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right mr-4">
                          <p className="text-xl font-bold text-gray-900">
                            ${(booking.total_price_cents / 100).toFixed(2)}
                          </p>
                          {(() => { const badge = paymentBadge(booking); return badge ? (
                            <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.text}
                            </span>
                          ) : null; })()}
                        </div>

                        <span
                          className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(
                            booking.status,
                          )}`}
                        >
                          {booking.status}
                        </span>

                        <div className="relative">
                          <select
                            value={booking.status}
                            onChange={(e) =>
                              handleStatusChange(booking.id, e.target.value)
                            }
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="requested">Requested</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No Show</option>
                            <option value="incomplete">Incomplete</option>
                          </select>
                        </div>

                        {booking.payment_status === "paid" && (
                          <button
                            onClick={() => {
                              setRefundBooking(booking);
                              setRefundType("full");
                              setRefundAmount("");
                              setRefundReason("requested_by_customer");
                              setRefundError("");
                              setRefundSuccess("");
                            }}
                            className="px-3 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                          >
                            Refund
                          </button>
                        )}
                        {booking.payment_status === "refunded" && (
                          <span className="px-3 py-2 text-sm font-semibold text-gray-400 border border-gray-200 rounded-lg">
                            Refunded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {bookings.length > 0 && (
            <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-blue-100 text-sm">Total Appointments</p>
                  <p className="text-3xl font-bold">{bookings.length}</p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm">Confirmed</p>
                  <p className="text-3xl font-bold">
                    {bookings.filter((b) => b.status === "confirmed").length}
                  </p>
                </div>
                <div>
                  <p className="text-blue-100 text-sm">Expected Revenue</p>
                  <p className="text-3xl font-bold">
                    $
                    {(
                      bookings
                        .filter((b) => b.status !== "cancelled")
                        .reduce((sum, b) => sum + b.total_price_cents, 0) / 100
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Refund Modal */}
      {refundBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Issue Refund</h2>
            <p className="text-sm text-gray-500 mb-4">
              {refundBooking.customers.full_name} — {refundBooking.services.name}
            </p>

            {/* Refund Type */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setRefundType("full")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                  refundType === "full"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Full Refund (${(refundBooking.total_price_cents / 100).toFixed(2)})
              </button>
              <button
                onClick={() => setRefundType("partial")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                  refundType === "partial"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Partial Refund
              </button>
            </div>

            {/* Partial amount input */}
            {refundType === "partial" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(refundBooking.total_price_cents / 100).toFixed(2)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate charge</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </div>

            {/* Warning */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              ⚠️ Refunds are funded from your connected Stripe account balance. Original processing fees may not be returned by Stripe.
            </div>

            {refundError && <p className="mb-3 text-sm text-red-600 font-medium">{refundError}</p>}
            {refundSuccess && <p className="mb-3 text-sm text-green-600 font-medium">{refundSuccess}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setRefundBooking(null)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                {refundSuccess ? "Close" : "Cancel"}
              </button>
              {!refundSuccess && (
                <button
                  onClick={handleRefundSubmit}
                  disabled={refunding}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-60"
                >
                  {refunding ? "Processing…" : "Confirm Refund"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
