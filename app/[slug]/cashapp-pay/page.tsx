"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

interface PaymentSettings {
  cashappEnabled: boolean;
  zelleEnabled: boolean;
  cashtag?: string | null;
  feeMode?: string;
  zellePhone?: string | null;
  zelleEmail?: string | null;
  businessId?: string;
  businessName?: string;
}

type PayMethod = "cash_app" | "zelle" | "cash" | null;

export default function ExternalPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const bookingId = searchParams.get("bookingId");
  const serviceCents = parseInt(searchParams.get("serviceCents") ?? "0", 10);
  const tipCents = parseInt(searchParams.get("tipCents") ?? "0", 10);

  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [zelleOpened, setZelleOpened] = useState(false);

  useEffect(() => {
    // Restore selected method if user returned after navigating to Cash App
    const saved = sessionStorage.getItem("cashapp-pay:method") as PayMethod;
    if (saved) {
      setSelectedMethod(saved);
      if (saved === "zelle") setZelleOpened(true);
      sessionStorage.removeItem("cashapp-pay:method");
    }
    fetch(`/api/cashapp/public-settings?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!settings?.cashappEnabled && !settings?.zelleEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-gray-700 font-medium">External payments are not available for this business.</p>
        </div>
      </div>
    );
  }

  const platformFeeCents = settings?.feeMode === "pass_to_customer" ? 100 : 0;
  const totalCents = serviceCents + tipCents + platformFeeCents;
  const totalDollars = (totalCents / 100).toFixed(2);

  const cashtag = settings?.cashtag ?? "";
  const cashAppLink = cashtag
    ? `https://cash.app/$${cashtag.replace(/^\$/, "")}/${totalDollars}`
    : null;

  const handleCashAppTap = () => {
    setSelectedMethod("cash_app");
    sessionStorage.setItem("cashapp-pay:method", "cash_app");
  };

  const handleZelleTap = () => {
    setSelectedMethod("zelle");
    setZelleOpened(true);
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !bookingId) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/payment-reports/customer-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          paymentMethod: selectedMethod,
          serviceCents,
          tipCents,
          feeMode: settings?.feeMode ?? "pass_to_customer",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      const qs = new URLSearchParams({
        totalCents: String(totalCents),
        businessName: settings?.businessName ?? "",
      });
      router.push(`/${slug}/cashapp-success?${qs.toString()}`);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-sm w-full">

        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-gray-900">Complete Your Payment</h1>
          {settings?.businessName && (
            <p className="text-gray-500 text-sm mt-0.5">{settings.businessName}</p>
          )}
        </div>

        {/* Amount breakdown */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Service</span>
            <span>${((serviceCents + platformFeeCents) / 100).toFixed(2)}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Total</span>
            <span className="text-lg">${totalDollars}</span>
          </div>
        </div>

        {/* Step 1 */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Step 1 — Send payment</p>
        <div className="space-y-2 mb-5">

          {/* Cash App — native <a> tag opens Cash App with amount pre-filled on first tap */}
          {settings?.cashappEnabled && cashAppLink && (
            <div>
              <a
                href={cashAppLink}
                onClick={handleCashAppTap}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition active:scale-95 ${
                  selectedMethod === "cash_app"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-sm">Pay with Cash App</p>
                  <p className="text-xs text-gray-500">Send ${totalDollars} to ${cashtag.replace(/^\$/, "")}</p>
                </div>
                {selectedMethod === "cash_app" && <span className="text-green-500 text-lg">✓</span>}
              </a>
              {selectedMethod === "cash_app" && (
                <p className="text-xs text-green-700 font-medium mt-2 text-center">Cash App opened — come back and tap &quot;I&apos;ve Paid&quot; after sending</p>
              )}
            </div>
          )}

          {/* Zelle */}
          {settings?.zelleEnabled && (
            <div>
              <button
                onClick={handleZelleTap}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition active:scale-95 ${
                  selectedMethod === "zelle"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">Z</span>
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-sm">Pay with Zelle</p>
                  <p className="text-xs text-gray-500">Send ${totalDollars} via your bank&apos;s app</p>
                </div>
                {selectedMethod === "zelle" && <span className="text-purple-500 text-lg">✓</span>}
              </button>
              {zelleOpened && (settings.zellePhone || settings.zelleEmail) && (
                <div className="mt-2 bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm text-purple-800 space-y-1">
                  <p className="font-semibold">Open Zelle in your banking app and send to:</p>
                  {settings.zellePhone && <p>📱 Phone: <strong>{settings.zellePhone}</strong></p>}
                  {settings.zelleEmail && <p>✉️ Email: <strong>{settings.zelleEmail}</strong></p>}
                  <p className="pt-1 border-t border-purple-200">💰 Amount: <strong>${totalDollars}</strong></p>
                </div>
              )}
            </div>
          )}

          {/* Cash */}
          <button
            onClick={() => setSelectedMethod("cash")}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition active:scale-95 ${
              selectedMethod === "cash"
                ? "border-amber-500 bg-amber-50"
                : "border-gray-200 hover:border-amber-300"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">$</span>
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-900 text-sm">Pay with Cash</p>
              <p className="text-xs text-gray-500">Hand ${totalDollars} to staff</p>
            </div>
            {selectedMethod === "cash" && <span className="text-amber-500 text-lg">✓</span>}
          </button>
        </div>

        {/* Step 2 */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Step 2 — Confirm payment</p>
        {!selectedMethod && (
          <p className="text-xs text-gray-400 mb-3">Select your payment method above first.</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!selectedMethod || submitting}
          className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-base shadow transition active:scale-95 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing...</>
          ) : "I've Paid"}
        </button>
        {submitError && (
          <p className="text-center text-xs text-red-500 mt-2">{submitError}</p>
        )}
        <p className="text-center text-xs text-gray-400 mt-3">
          Staff will confirm your payment shortly.
        </p>
      </div>
    </div>
  );
}
