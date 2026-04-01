"use client";

import { formatPhone } from "@/lib/utils/formatPhone";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { sendPush } from "@/lib/utils/sendPush";

interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  start_ts: string;
  status: string;
  total_price_cents: number;
  customers: {
    full_name: string | null;
    phone: string;
  };
}

export default function MobileAppointmentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessSlug, setBusinessSlug] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadPendingBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time: reload when new booking requests come in
  useEffect(() => {
    const channel = supabase
      .channel("admin-mobile-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        loadPendingBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPendingBookings = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("owner_user_id", user.id)
      .single();

    if (!business) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data: bookResult } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, business_id, start_ts, status, total_price_cents, customers(full_name, phone)",
      )
      .eq("business_id", business.id)
      .eq("status", "requested")
      .order("start_ts", { ascending: true });

    setBookings((bookResult as Booking[]) || []);
    setBusinessSlug(business.slug || "");
    setLoading(false);
  };

  const handleAccept = async (booking: Booking) => {
    await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking.id);

    // Notify customer their booking is confirmed
    const apptTime = new Date(booking.start_ts).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    await sendPush("customer", booking.customer_id, {
      title: "Appointment Confirmed ✅",
      body: `Your appointment on ${apptTime} is confirmed. See you then!`,
      url: `/${businessSlug}/notifications`,
    });

    loadPendingBookings();
  };

  const handleDecline = async (booking: Booking) => {
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    // Notify customer their booking was declined
    const apptTime = new Date(booking.start_ts).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    await sendPush("customer", booking.customer_id, {
      title: "Appointment Update",
      body: `Unfortunately your appointment on ${apptTime} could not be confirmed. Please rebook at a different time.`,
      url: `/${businessSlug}/notifications`,
    });

    loadPendingBookings();
  };

  const handleComplete = async (bookingId: string) => {
    // Get the booking details first
    const { data: booking } = await supabase
      .from("bookings")
      .select("business_id, customer_id, payment_status, customers(phone)")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) {
      // Nothing to do
      loadPendingBookings();
      return;
    }

    // Update booking status
    await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    // ---------------------------
    // Loyalty points (completion)
    // Only award when payment has been collected
    // ---------------------------
    const isPaid = ["paid", "cash_paid"].includes(booking.payment_status ?? "");
    const { data: loyaltySettings } = await supabase
      .from("loyalty_settings")
      .select("enabled, earn_on_completion, points_per_event")
      .eq("business_id", booking.business_id)
      .single();

    if (isPaid && loyaltySettings?.enabled && loyaltySettings.earn_on_completion) {
      // Check if points already awarded (use maybeSingle so "no row" is not an error)
      const { data: existingPoints } = await supabase
        .from("loyalty_ledger")
        .select("id, slug")
        .eq("related_booking_id", bookingId)
        .eq("event_type", "completion")
        .maybeSingle();

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

    // ---------------------------
    // Referral rewards
    // ---------------------------
    const { data: referralSettings } = await supabase
      .from("loyalty_settings")
      .select("referral_enabled, referrer_reward_points")
      .eq("business_id", booking.business_id)
      .single();

    if (referralSettings?.referral_enabled !== false) {
      const { data: referralRecord } = await supabase
        .from("referrals")
        .select("id, referrer_customer_id")
        .eq("business_id", booking.business_id)
        .eq("referred_customer_id", booking.customer_id)
        .eq("status", "pending")
        .maybeSingle();

      if (referralRecord) {
        const referrerPoints = referralSettings?.referrer_reward_points ?? 15;

        // Optional: prevent double-award if button is tapped twice
        const { data: existingReferralPoints } = await supabase
          .from("loyalty_ledger")
          .select("id, slug")
          .eq("related_booking_id", bookingId)
          .eq("event_type", "referral")
          .eq("customer_id", referralRecord.referrer_customer_id)
          .maybeSingle();

        if (!existingReferralPoints) {
          // Award points to the referrer
          await supabase.from("loyalty_ledger").insert({
            business_id: booking.business_id,
            customer_id: referralRecord.referrer_customer_id,
            points_delta: referrerPoints,
            event_type: "referral",
            related_booking_id: bookingId,
          });
        }

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

        console.log("🎉 Referral reward awarded:", referrerPoints, "points");
      }
    }

    // Push notification to customer to open app and pay/tip
    const isUnpaid = booking.payment_status === "unpaid";
    await sendPush("customer", booking.customer_id, {
      title: "Appointment Complete!",
      body: isUnpaid
        ? "Your appointment is done. Open the app to complete your payment."
        : "Thanks for your visit! Open the app to leave a tip.",
      url: `/${businessSlug}/dashboard`,
    });

    loadPendingBookings();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link
        href="/admin/mobile/menu"
        className="text-blue-600 text-lg mb-4 block"
      >
        ← Back to Menu
      </Link>

      <h1 className="text-2xl font-bold mb-4 text-gray-900">
        Pending Appointments
      </h1>

      {loading ? (
        <p>Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white p-8 rounded-xl text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-xl font-bold text-gray-900">All caught up!</p>
          <p className="text-gray-600 mt-2">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-blue-100 p-5 rounded-xl shadow border-2 border-blue-600"
            >
              <div className="mb-3">
                <p className="text-2xl font-bold text-gray-900">
                  {new Date(booking.start_ts).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(booking.start_ts).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="mb-4 pb-4 border-b">
                <p className="text-base font-semibold text-gray-900">
                  {booking.customers.full_name || "Guest"}
                </p>
                <p className="text-sm text-gray-600">
                  {formatPhone(booking.customers.phone)}
                </p>
                <p className="text-lg font-bold text-gray-900 mt-2">
                  ${(booking.total_price_cents / 100).toFixed(2)}
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDecline(booking)}
                    className="py-3 bg-red-50 text-red-700 rounded-xl font-bold border-2 border-red-200"
                  >
                    ✕ Decline
                  </button>
                  <button
                    onClick={() => handleAccept(booking)}
                    className="py-3 bg-blue-500 text-white rounded-xl font-bold"
                  >
                    ✓ Accept
                  </button>
                </div>

                <button
                  onClick={() => handleComplete(booking.id)}
                  className="w-full py-3 bg-green-500 text-white rounded-xl font-bold"
                >
                  ✓ Mark Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
