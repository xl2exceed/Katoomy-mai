"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const TIP_PRESETS = [
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.2 },
  { label: "25%", pct: 0.25 },
];

interface BookingInfo {
  serviceName: string;
  serviceCents: number;
  businessId: string;
  slug: string;
}

export default function PayQrPage() {
  const params = useParams();
  const slug = params.slug as string;
  const bookingId = params.bookingId as string;

  const router = useRouter();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tipCents, setTipCents] = useState(0);
  const [customDollars, setCustomDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    fetch(`/api/staff/qr-booking-info?bookingId=${bookingId}&slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error);
        else setInfo(d);
      })
      .catch(() => setLoadError("Failed to load payment info."));
  }, [bookingId, slug]);

  const handlePreset = (pct: number) => {
    if (!info) return;
    setCustomDollars("");
    setTipCents(Math.round(info.serviceCents * pct));
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

  const handlePay = async () => {
    if (!info) return;
    setSubmitting(true);
    setPayError("");
    // Redirect to payment method selection (Cash App vs Credit Card)
    const totalCentsForPayment = info.serviceCents + tipCents;
    router.push(
      `/${slug}/choose-payment?bookingId=${bookingId}&serviceCents=${info.serviceCents}&tipCents=${tipCents}&totalCents=${totalCentsForPayment}&businessId=${info.businessId}`
    );
  };

  const isPresetSelected = (pct: number) =>
    !!info && tipCents === Math.round(info.serviceCents * pct) && customDollars === "";

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-gray-700 font-medium">This payment link is invalid or has expired.</p>
          <p className="text-gray-500 text-sm mt-2">Please ask staff to generate a new one.</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalCents = info.serviceCents + tipCents;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">💳</div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-600 mt-1 font-medium">{info.serviceName}</p>
          <p className="text-gray-500 text-sm mt-0.5">
            Service total: ${(info.serviceCents / 100).toFixed(2)}
          </p>
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
          Would you like to add a tip?
        </p>

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

        <div className="grid grid-cols-3 gap-3 mb-4">
          {TIP_PRESETS.map(({ label, pct }) => {
            const cents = Math.round(info.serviceCents * pct);
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

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Custom Tip</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
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

        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Service</span>
            <span>${(info.serviceCents / 100).toFixed(2)}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 mt-2 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        {payError && <p className="text-red-600 text-sm mb-3 text-center">{payError}</p>}

        <button
          onClick={handlePay}
          disabled={submitting}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? "Redirecting..." : `Pay $${(totalCents / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
