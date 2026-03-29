"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIP_PRESETS = [
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.2 },
  { label: "25%", pct: 0.25 },
];

interface BookingData {
  total_price_cents: number;
  deposit_amount_cents: number | null;
  business_id: string;
  payment_status: string;
  services: { name: string; price_cents: number } | null;
  customers: { email: string | null } | null;
}

export default function PayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const bookingId = searchParams.get("bookingId");

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipCents, setTipCents] = useState(0);
  const [customDollars, setCustomDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!bookingId) {
      router.push(`/${slug}/dashboard`);
      return;
    }
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const loadBooking = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("total_price_cents, deposit_amount_cents, business_id, payment_status, services(name, price_cents), customers(email)")
      .eq("id", bookingId!)
      .single();

    if (!data) {
      router.push(`/${slug}/dashboard`);
      return;
    }

    // If already paid, redirect home
    if (data.payment_status === "paid") {
      router.push(`/${slug}/dashboard`);
      return;
    }

    setBooking(data as BookingData);
    setLoading(false);
  };

  const handlePreset = (pct: number) => {
    if (!booking) return;
    setCustomDollars("");
    setTipCents(Math.round(booking.total_price_cents * pct));
  };

  const handleCustomChange = (val: string) => {
    setCustomDollars(val);
    const parsed = parseFloat(val);
    setTipCents(!isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0);
  };

  const handleNoTip = () => {
    setCustomDollars("");
    setTipCents(0);
  };

  const getServiceCents = () => {
    if (!booking) return 0;
    if (booking.payment_status === "deposit_paid") {
      const depositPaid = booking.deposit_amount_cents ?? 0;
      const fullPrice = booking.total_price_cents > depositPaid
        ? booking.total_price_cents
        : (booking.services as { name: string; price_cents: number } | null)?.price_cents ?? booking.total_price_cents;
      return fullPrice - depositPaid;
    }
    return booking.total_price_cents;
  };

  const handlePay = () => {
    if (!booking) return;
    setSubmitting(true);
    // Route through choose-payment so customers can pick Cash App or Credit Card
    const sc = getServiceCents();
    const p = new URLSearchParams({
      bookingId: bookingId ?? "",
      serviceCents: String(sc),
      tipCents: String(tipCents),
      source: "pay",
    });
    router.push(`/${slug}/choose-payment?${p.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const serviceCents = booking ? getServiceCents() : 0;
  const servicePriceDollars = (serviceCents / 100).toFixed(2);
  const totalCents = serviceCents + tipCents;
  const totalDollars = (totalCents / 100).toFixed(2);
  const serviceName =
    (booking?.services as { name: string; price_cents: number } | null)?.name || "Service";
  const isDepositPayment = booking?.payment_status === "deposit_paid";

  const isPresetSelected = (pct: number) =>
    tipCents === Math.round(serviceCents * pct) &&
    customDollars === "";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">💳</div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-600 mt-1 font-medium">{serviceName}</p>
          <p className="text-gray-500 text-sm mt-0.5">
            {isDepositPayment ? "Remaining balance" : "Service total"}: ${servicePriceDollars}
          </p>
        </div>

        {/* Tip prompt */}
        <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
          Would you like to add a tip?
        </p>

        {/* No tip */}
        <button
          onClick={handleNoTip}
          className={`w-full py-3 rounded-xl font-semibold text-sm border-2 transition mb-3 ${
            tipCents === 0 && customDollars === ""
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
          }`}
        >
          No tip
        </button>

        {/* Preset buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {TIP_PRESETS.map(({ label, pct }) => {
            const cents = Math.round(serviceCents * pct);
            return (
              <button
                key={label}
                onClick={() => handlePreset(pct)}
                className={`py-4 rounded-xl font-semibold text-sm border-2 transition ${
                  isPresetSelected(pct)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="text-lg font-bold">{label}</div>
                <div className="text-xs mt-0.5 opacity-80">
                  ${(cents / 100).toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Tip
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={customDollars}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full pl-7 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{isDepositPayment ? "Remaining balance" : "Service"}</span>
            <span>${servicePriceDollars}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 mt-2 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>${totalDollars}</span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={submitting}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? "Redirecting..." : `Pay $${totalDollars}`}
        </button>
      </div>
    </div>
  );
}
