"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
  customers: {
    full_name: string;
    phone: string;
    email: string | null;
  };
  staff: { full_name: string } | null;
}

interface Business {
  id: string;
  name: string;
  primary_color: string;
}

export default function ConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeMode, setFeeMode] = useState<string>("pass_to_customer");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const supabase = createClient();

    // Get booking ID from sessionStorage
    const bookingId = sessionStorage.getItem("bookingId");

    if (!bookingId) {
      router.push(`/${slug}/services`);
      return;
    }

    // Get business
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color")
      .eq("slug", slug)
      .single();

    if (businessData) {
      setBusiness(businessData);

      // Fetch fee_mode for display
      const { data: cashSettings } = await supabase
        .from("cashapp_settings")
        .select("fee_mode")
        .eq("business_id", businessData.id)
        .maybeSingle();
      setFeeMode(cashSettings?.fee_mode ?? "pass_to_customer");

      // Get booking with customer and service info
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(
          `
          *,
          services(name, duration_minutes, price_cents),
          customers(full_name, phone, email),
          staff(full_name)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (bookingData) {
        setBooking(bookingData);
      }
    }

    setLoading(false);

    // Clear sessionStorage
    sessionStorage.removeItem("selectedServiceId");
    sessionStorage.removeItem("bookingDate");
    sessionStorage.removeItem("bookingTime");
    sessionStorage.removeItem("bookingId");
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${
            business?.primary_color || "#3B82F6"
          } 0%, ${business?.primary_color || "#3B82F6"}DD 100%)`,
        }}
      >
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Booking Confirmed</p>
      </div>

      {/* Success Content */}
      <div className="p-6">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Booking Confirmed!
        </h2>
        <p className="text-gray-600 text-center mb-8">
          We&apos;ve sent a confirmation to your phone
        </p>

        {/* Booking Details Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
            <p className="text-white font-semibold text-lg">
              {booking?.services.name}
            </p>
            <p className="text-blue-100 text-sm mt-1">
              {booking?.services.duration_minutes} minutes
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">📅</span>
              <div>
                <p className="text-sm text-gray-500 font-medium">Date & Time</p>
                <p className="text-gray-900 font-semibold">
                  {booking && formatDate(booking.start_ts)}
                </p>
                <p className="text-gray-900">
                  {booking && formatTime(booking.start_ts)}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-2xl mr-3">👤</span>
              <div>
                <p className="text-sm text-gray-500 font-medium">Customer</p>
                <p className="text-gray-900 font-semibold">
                  {booking?.customers.full_name}
                </p>
                <p className="text-gray-600 text-sm">
                  {booking?.customers.phone}
                </p>
                {booking?.customers.email && (
                  <p className="text-gray-600 text-sm">
                    {booking.customers.email}
                  </p>
                )}
              </div>
            </div>

            {booking?.staff?.full_name && (
              <div className="flex items-start">
                <span className="text-2xl mr-3">✂️</span>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Staff Member</p>
                  <p className="text-gray-900 font-semibold">{booking.staff.full_name}</p>
                </div>
              </div>
            )}

            <div className="flex items-start">
              <span className="text-2xl mr-3">💰</span>
              <div>
                {booking?.payment_status === "deposit_paid" ? (
                  <>
                    <p className="text-sm text-gray-500 font-medium">Deposit Paid</p>
                    <p className="text-gray-900 font-bold text-2xl">
                      ${((booking.deposit_amount_cents ?? 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-orange-600 font-semibold mt-2">
                      Remaining balance due at appointment
                    </p>
                    <p className="text-orange-700 font-bold text-xl">
                      ${(() => { const d = booking.deposit_amount_cents ?? 0; const full = booking.total_price_cents > d ? booking.total_price_cents : booking.services.price_cents; const platformFee = feeMode === "pass_to_customer" ? 100 : 0; return ((full + platformFee - d) / 100).toFixed(2); })()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 font-medium">Total</p>
                    <p className="text-gray-900 font-bold text-2xl">
                      ${booking ? ((booking.total_price_cents + (feeMode === "pass_to_customer" ? 100 : 0)) / 100).toFixed(2) : "0.00"}
                    </p>
                    {booking && booking.services.price_cents > booking.total_price_cents && (
                      <p className="text-sm text-blue-600 font-medium mt-1">⭐ Elite Member discount applied</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📱</span>
                <p className="text-sm text-gray-600">
                  You&apos;ll receive a reminder before your appointment
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href={`/${slug}/services`}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-center shadow-lg transition"
          >
            Book Another Appointment
          </Link>

          <Link
            href={`/${slug}/dashboard`}
            className="block w-full text-white py-4 rounded-xl font-semibold text-center shadow-lg transition hover:opacity-90"
            style={{ backgroundColor: business?.primary_color || "#3B82F6" }}
          >
            <div>Go to My Page</div>
            <div className="text-xs text-white/80 mt-1">
              Appointments · Rewards · Referrals
            </div>
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900 font-medium mb-2">
            Need to make changes?
          </p>
          <p className="text-sm text-blue-700">
            Please call or text {business?.name} directly to reschedule or
            cancel your appointment.
          </p>
        </div>
      </div>
    </div>
  );
}
