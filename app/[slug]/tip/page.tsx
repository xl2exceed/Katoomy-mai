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
  business_id: string;
  customers: { email: string | null } | null;
}

export default function TipPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const bookingId = searchParams.get("bookingId");

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [customDollars, setCustomDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feeMode, setFeeMode] = useState<string>("pass_to_customer");

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
      .select("total_price_cents, business_id, customers(email)")
      .eq("id", bookingId!)
      .single();

    if (!data) {
      router.push(`/${slug}/dashboard`);
      return;
    }
    setBooking(data as BookingData);

    // Fetch fee_mode for display
    const { data: cashSettings } = await supabase
      .from("cashapp_settings")
      .select("fee_mode")
      .eq("business_id", data.business_id)
      .maybeSingle();
    setFeeMode(cashSettings?.fee_mode ?? "pass_to_customer");

    setLoading(false);
  };

  const handlePreset = (pct: number) => {
    if (!booking) return;
    setCustomDollars("");
    setSelectedCents(Math.round(booking.total_price_cents * pct));
  };

  const handleCustomChange = (val: string) => {
    setCustomDollars(val);
    const parsed = parseFloat(val);
    setSelectedCents(!isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : null);
  };

  const handleSubmit = async () => {
    if (!selectedCents || !booking) return;
    setSubmitting(true);
    // Redirect to payment method selection (Cash App vs Credit Card)
    // source=tip tells choose-payment to use the tip-checkout Stripe flow
    router.push(
      `/${slug}/choose-payment?bookingId=${bookingId}&tipCents=${selectedCents}&businessId=${booking.business_id}&source=tip`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const platformFeeDisplay = feeMode === "pass_to_customer" ? 100 : 0;
  const servicePriceDollars = (((booking?.total_price_cents ?? 0) + platformFeeDisplay) / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">💝</div>
          <h1 className="text-2xl font-bold text-gray-900">Leave a Tip</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Service total: ${servicePriceDollars}
          </p>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {TIP_PRESETS.map(({ label, pct }) => {
            const cents = Math.round((booking?.total_price_cents ?? 0) * pct);
            const isSelected = selectedCents === cents && customDollars === "";
            return (
              <button
                key={label}
                onClick={() => handlePreset(pct)}
                className={`py-4 rounded-xl font-semibold text-sm border-2 transition ${
                  isSelected
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
            Custom Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              $
            </span>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              value={customDollars}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full pl-7 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {selectedCents !== null && (
          <div className="mb-4 text-center text-sm text-gray-600">
            Tip amount:{" "}
            <span className="font-bold text-gray-900">
              ${(selectedCents / 100).toFixed(2)}
            </span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedCents || submitting}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed mb-3 transition"
        >
          {submitting ? "Redirecting..." : "Send Tip"}
        </button>

        <button
          onClick={() => router.push(`/${slug}/dashboard`)}
          className="w-full py-3 text-gray-500 font-medium text-sm"
        >
          No thanks, skip
        </button>
      </div>
    </div>
  );
}
