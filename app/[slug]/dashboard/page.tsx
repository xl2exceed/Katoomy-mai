"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PushPermissionPrompt from "@/components/PushPermissionPrompt";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  referral_code: string | null;
}

interface Booking {
  id: string;
  start_ts: string;
  end_ts: string;
  status: string;
  total_price_cents: number;
  payment_status: string;
  deposit_amount_cents: number | null;
  services: {
    name: string;
    duration_minutes: number;
    price_cents: number;
  };
  staff: { full_name: string } | null;
}

interface Business {
  id: string;
  name: string;
  primary_color: string;
  logo_url: string | null;
}

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

export default function DashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [awaitingPaymentBookings, setAwaitingPaymentBookings] = useState<Booking[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [memberDiscount, setMemberDiscount] = useState<number | null>(null);
  const [referralStats, setReferralStats] = useState({
    total: 0,
    completed: 0,
  });
  const [referrerPoints, setReferrerPoints] = useState(15);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [loading, setLoading] = useState(true);

  // Phone prompt states
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<"not_found" | null>(null);
  const [phoneLooking, setPhoneLooking] = useState(false);

  const supabase = createClient();

  // Re-runs only the booking queries (called by real-time subscription)
  const reloadBookings = async (customerId: string) => {
    const now = new Date().toISOString();
    const { data: upcoming } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes, price_cents), staff(full_name)")
      .eq("customer_id", customerId)
      .gte("start_ts", now)
      .in("status", ["requested", "confirmed"])
      .order("start_ts", { ascending: true });
    setUpcomingBookings(upcoming || []);

    const { data: awaitingPayment } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes, price_cents), staff(full_name)")
      .eq("customer_id", customerId)
      .eq("status", "completed")
      .in("payment_status", ["unpaid", "deposit_paid"])
      .not("payment_status", "eq", "custom_paid")
      .order("start_ts", { ascending: false });
    setAwaitingPaymentBookings((awaitingPayment as Booking[]) || []);
  };

  useEffect(() => {
    initDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Real-time: update booking lists instantly when staff/admin changes a booking
  useEffect(() => {
    if (!customer) return;
    const cid = customer.id;
    const channel = supabase
      .channel(`customer-bookings-${cid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${cid}` },
        () => { reloadBookings(cid); }
      )
      .subscribe();
    // BroadcastChannel: reload instantly when a custom payment is recorded from the Take Payment page
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("katoomy-booking-update");
      bc.onmessage = () => { reloadBookings(cid); };
    } catch { /* not supported */ }
    return () => {
      supabase.removeChannel(channel);
      bc?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  // Real-time: update loyalty points instantly when staff/admin marks a booking complete
  useEffect(() => {
    if (!customer) return;
    const cid = customer.id;
    const channel = supabase
      .channel(`customer-loyalty-${cid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loyalty_ledger", filter: `customer_id=eq.${cid}` },
        async () => {
          const { data } = await supabase
            .from("loyalty_ledger")
            .select("points_delta")
            .eq("customer_id", cid);
          const total = data?.reduce((sum: number, e: { points_delta: number }) => sum + e.points_delta, 0) ?? 0;
          setLoyaltyPoints(total);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  const initDashboard = async () => {
    // Load business first (always needed for branding)
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color, logo_url")
      .eq("slug", slug)
      .single();

    if (businessData) {
      setBusiness(businessData);
    }

    // Check localStorage for a saved phone number
    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);

    if (!savedPhone) {
      // No phone on device — show the prompt
      setLoading(false);
      setShowPhonePrompt(true);
      return;
    }

    // Phone exists — try to load customer data
    if (businessData) {
      await loadCustomerData(businessData, savedPhone);
    }

    setLoading(false);
  };

  const loadCustomerData = async (
    biz: Business,
    phone: string,
  ): Promise<boolean> => {
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", biz.id)
      .eq("phone", phone)
      .single();

    if (!customerData) {
      return false;
    }

    setCustomer(customerData);

    const now = new Date().toISOString();

    const { data: upcoming } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes, price_cents), staff(full_name)")
      .eq("customer_id", customerData.id)
      .gte("start_ts", now)
      .in("status", ["requested", "confirmed"])
      .order("start_ts", { ascending: true });

    setUpcomingBookings(upcoming || []);

    const { data: awaitingPayment } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes, price_cents), staff(full_name)")
      .eq("customer_id", customerData.id)
      .eq("status", "completed")
      .in("payment_status", ["unpaid", "deposit_paid"])
      .not("payment_status", "eq", "custom_paid")
      .order("start_ts", { ascending: false });

    setAwaitingPaymentBookings((awaitingPayment as Booking[]) || []);

    const { data: loyaltyData } = await supabase
      .from("loyalty_ledger")
      .select("points_delta")
      .eq("customer_id", customerData.id);

    const totalPoints =
      loyaltyData?.reduce(
        (sum: number, entry: { points_delta: number }) =>
          sum + entry.points_delta,
        0,
      ) || 0;
    setLoyaltyPoints(totalPoints);

    const { data: referralsData } = await supabase
      .from("referrals")
      .select("status")
      .eq("referrer_customer_id", customerData.id);

    setReferralStats({
      total: referralsData?.length || 0,
      completed:
        referralsData?.filter(
          (r: { status: string }) => r.status === "completed",
        ).length || 0,
    });

    const { data: loyaltySettings } = await supabase
      .from("loyalty_settings")
      .select("referrer_reward_points")
      .eq("business_id", biz.id)
      .maybeSingle();
    if (loyaltySettings?.referrer_reward_points) {
      setReferrerPoints(loyaltySettings.referrer_reward_points);
    }

    // Load active membership
    const { data: memberSub } = await supabase
      .from("member_subscriptions")
      .select("membership_plans(discount_percent)")
      .eq("customer_id", customerData.id)
      .eq("business_id", biz.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberSub?.membership_plans) {
      const plans = memberSub.membership_plans as unknown as { discount_percent: number };
      setMemberDiscount(plans.discount_percent);
    }

    return true;
  };

  const handlePhoneLookup = async () => {
    const cleaned = phoneInput.replace(/\D/g, "");
    if (cleaned.length < 10) return;

    setPhoneLooking(true);
    setPhoneError(null);

    // Business should already be loaded; if not, bail
    if (!business) {
      setPhoneLooking(false);
      return;
    }

    const found = await loadCustomerData(business, cleaned);

    if (found) {
      // Save to localStorage so the device remembers this person
      localStorage.setItem(PHONE_STORAGE_KEY, cleaned);
      setShowPhonePrompt(false);
    } else {
      setPhoneError("not_found");
    }

    setPhoneLooking(false);
  };

  const handleCancelAppointment = async () => {
    if (!selectedBooking || !customer || !business) return;

    setCancelling(true);
    setCancelError("");

    try {
      const apptTimeStr = new Date(selectedBooking.start_ts).toLocaleString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      );

      const payload = {
        bookingId: selectedBooking.id,
        customerId: customer.id,
        businessId: business.id,
        customerName: customer.full_name,
        startTs: selectedBooking.start_ts,
        apptTimeStr,
      };

      console.log("Sending cancel request:", payload);

      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("Cancel response:", res.status, data);

      if (!res.ok) {
        setCancelError(`Error ${res.status}: ${JSON.stringify(data)}`);
      } else {
        setUpcomingBookings((prev) =>
          prev.filter((booking) => booking.id !== selectedBooking.id),
        );
        setCancelModalOpen(false);
        setSelectedBooking(null);
      }
    } catch (err) {
      console.error("Cancel fetch error:", err);
      setCancelError(`Fetch failed: ${err}`);
    }

    setCancelling(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const primaryColor = business?.primary_color || "#3B82F6";

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: primaryColor }}
          />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ─── Phone Prompt ────────────────────────────────────────────────────────────
  if (showPhonePrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div
          className="p-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}DD 100%)`,
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {business?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-12 h-12 rounded-full bg-white p-1 object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{business?.name}</h1>
                <p className="text-sm opacity-90">Customer Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/notifications`}
                className="px-3 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition text-sm font-semibold text-white"
              >
                🔔
              </Link>
              <Link
                href={`/${slug}`}
                className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition text-sm font-semibold text-gray-900"
              >
                Home
              </Link>
            </div>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📱</div>
              <h2 className="text-xl font-bold text-gray-900">Welcome Back!</h2>
              <p className="text-gray-600 mt-2 text-sm">
                Enter your phone number to access your dashboard.
              </p>
            </div>

            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                setPhoneError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center tracking-wider focus:outline-none focus:ring-2 mb-4 text-gray-900"
              style={{ focusRingColor: primaryColor } as React.CSSProperties}
            />

            {/* Not found message */}
            {phoneError === "not_found" && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-red-700 font-semibold text-sm">
                  Number not found
                </p>
                <p className="text-red-600 text-xs mt-1">
                  Click &quot;Book Appointment&quot; below to schedule your
                  first appointment.
                </p>
                <Link
                  href={`/${slug}/services`}
                  className="inline-block mt-3 px-5 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  Book Appointment
                </Link>
              </div>
            )}

            <button
              onClick={handlePhoneLookup}
              disabled={
                phoneLooking || phoneInput.replace(/\D/g, "").length < 10
              }
              className="w-full py-3 rounded-xl text-white font-semibold text-base transition disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {phoneLooking ? "Looking you up..." : "Find My Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Full Dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}DD 100%)`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {business?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-12 h-12 rounded-full bg-white p-1 object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{business?.name}</h1>
                <p className="text-sm opacity-90">Customer Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/notifications`}
                className="px-3 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition text-sm font-semibold text-white"
              >
                🔔
              </Link>
              <Link
                href={`/${slug}`}
                className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition text-sm font-semibold text-gray-900"
              >
                Home
              </Link>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white bg-opacity-20 rounded-xl p-4 text-gray-900">
            <p className="text-lg font-semibold">{customer?.full_name}</p>
            <p className="text-sm opacity-90">{customer?.phone}</p>
            {customer?.email && (
              <p className="text-sm opacity-90">{customer.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Elite Membership */}
        <div className={`rounded-xl shadow-sm border-2 p-5 flex items-center justify-between ${memberDiscount ? "bg-gradient-to-r from-blue-600 to-indigo-700 border-blue-600 text-white" : "bg-white border-gray-200"}`}>
          <div>
            <h2 className={`text-lg font-bold ${memberDiscount ? "text-white" : "text-gray-900"}`}>
              Elite Membership
            </h2>
            {memberDiscount ? (
              <p className="text-blue-100 text-sm mt-0.5">⭐ Active — {memberDiscount}% off every service</p>
            ) : (
              <p className="text-gray-500 text-sm mt-0.5">Save on every visit with a membership</p>
            )}
          </div>
          <Link
            href={`/${slug}/membership`}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${memberDiscount ? "bg-white text-blue-700" : "bg-blue-600 text-white"}`}
          >
            {memberDiscount ? "View" : "Join"}
          </Link>
        </div>

        {/* Loyalty Points */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Loyalty Points
              </h2>
              <p
                className="text-3xl font-bold mt-2"
                style={{ color: primaryColor }}
              >
                {loyaltyPoints}
              </p>
              <p className="text-sm text-gray-600 mt-1">points available</p>
            </div>
            <div className="text-6xl">🎁</div>
          </div>
        </div>

        {/* Payment Due */}
        {awaitingPaymentBookings.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-orange-400 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              💳 Payment Due
            </h2>
            <div className="space-y-3">
              {awaitingPaymentBookings.map((booking) => {
                const isDeposit = booking.payment_status === "deposit_paid";
                const depositPaid = booking.deposit_amount_cents ?? 0;
                const amountDue = isDeposit
                  ? (booking.total_price_cents > depositPaid ? booking.total_price_cents : booking.services.price_cents) - depositPaid
                  : booking.total_price_cents;
                return (
                  <div
                    key={booking.id}
                    className="border border-orange-200 rounded-xl p-4 bg-orange-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {booking.services.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(booking.start_ts)}
                        </p>
                        {booking.staff?.full_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            With {booking.staff.full_name}
                          </p>
                        )}
                        {isDeposit && (
                          <p className="text-xs text-orange-600 mt-1">
                            Remaining balance
                          </p>
                        )}
                      </div>
                      <p className="font-bold text-gray-900">
                        ${(amountDue / 100).toFixed(2)}
                      </p>
                    </div>
                    <Link
                      href={`/${slug}/pay?bookingId=${booking.id}`}
                      className="block w-full text-center py-3 rounded-xl text-white font-bold bg-orange-500 hover:bg-orange-600 transition"
                    >
                      Pay Now
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Upcoming Appointments
            </h2>
            <Link
              href={`/${slug}/services`}
              className="text-sm font-semibold"
              style={{ color: primaryColor }}
            >
              Book Another
            </Link>
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No upcoming appointments</p>
              <Link
                href={`/${slug}/services`}
                className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                Book an Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border-2 rounded-xl p-4"
                  style={{ borderColor: primaryColor }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        {booking.services.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDate(booking.start_ts)} at{" "}
                        {formatTime(booking.start_ts)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {booking.services.duration_minutes} minutes
                      </p>
                      {booking.staff?.full_name && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          With {booking.staff.full_name}
                        </p>
                      )}
                    {booking.payment_status === "deposit_paid" && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          Deposit paid · Balance due at appointment
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {booking.payment_status === "deposit_paid"
                          ? (() => { const d = booking.deposit_amount_cents ?? 0; const full = booking.total_price_cents > d ? booking.total_price_cents : booking.services.price_cents; return `$${((full - d) / 100).toFixed(2)}`; })()
                          : `$${(booking.total_price_cents / 100).toFixed(2)}`}
                      </p>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setCancelModalOpen(true);
                      }}
                      className="flex-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setRescheduleModalOpen(true);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition text-sm"
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refer & Earn */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Refer & Earn</h2>
          {customer?.referral_code ? (
            <>
              <div className="text-center py-6 bg-gray-50 rounded-lg mb-4">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `${window.location.origin}/${slug}?ref=${customer.referral_code}`,
                  )}`}
                  alt="Referral QR Code"
                  width={192}
                  height={192}
                  className="mx-auto rounded-lg shadow-md"
                  unoptimized
                />
                <p className="text-sm font-semibold text-gray-900 mt-4">
                  Your Referral Code
                </p>
                <p
                  className="text-2xl font-bold mt-2"
                  style={{ color: primaryColor }}
                >
                  {customer.referral_code}
                </p>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 mb-2">Your Referral Code</p>
                <p
                  className="text-2xl font-bold tracking-wider"
                  style={{ color: primaryColor }}
                >
                  {customer.referral_code}
                </p>
              </div>

              <button
                onClick={() => {
                  const link = `${window.location.origin}/${slug}?ref=${customer.referral_code}`;
                  navigator.clipboard.writeText(link);
                  alert("Referral link copied!");
                }}
                className="w-full px-4 py-3 rounded-lg text-white font-semibold mb-4"
                style={{ backgroundColor: primaryColor }}
              >
                📋 Copy Referral Link
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {referralStats.total}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Total Referrals</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {referralStats.completed}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Completed</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  💡 How It Works:
                </p>
                <ol className="text-xs text-blue-800 space-y-1">
                  <li>1. Share your QR code or link with friends</li>
                  <li>2. They scan/click and book an appointment</li>
                  <li>3. You earn {referrerPoints} points when they complete it! 🎉</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No referral code available</p>
            </div>
          )}
        </div>


      </div>

      {customer && business && (
        <PushPermissionPrompt
          customerId={customer.id}
          primaryColor={primaryColor}
        />
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Cancel Appointment?
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="font-semibold text-gray-900">
                {selectedBooking.services.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(selectedBooking.start_ts)} at{" "}
                {formatTime(selectedBooking.start_ts)}
              </p>
              <p className="text-sm text-gray-900 font-bold mt-2">
                ${(selectedBooking.total_price_cents / 100).toFixed(2)}
              </p>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to cancel this appointment? This action
              cannot be undone.
            </p>
            {cancelError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-xs font-mono break-all">
                  {cancelError}
                </p>
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setSelectedBooking(null);
                }}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reschedule Appointment
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="font-semibold text-gray-900">
                {selectedBooking.services.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Current: {formatDate(selectedBooking.start_ts)} at{" "}
                {formatTime(selectedBooking.start_ts)}
              </p>
            </div>
            <p className="text-gray-700 mb-6">
              You&apos;ll be redirected to the booking page to select a new date
              and time.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setRescheduleModalOpen(false);
                  setSelectedBooking(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Store the service so book page can load it without going through services
                  // We navigate to book with rescheduleBookingId so it updates instead of creating
                  window.location.href = `/${slug}/book?rescheduleBookingId=${selectedBooking.id}`;
                }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
