"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

interface CashAppSettings {
  cashappEnabled: boolean;
  cashtag?: string;
  phoneNumber?: string;
  qrCodeUrl?: string;
  feeMode?: string;
  businessId?: string;
  businessName?: string;
}

export default function ChoosePaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  // These come from the tip page via query params
  const bookingId = searchParams.get("bookingId");
  const serviceCents = parseInt(searchParams.get("serviceCents") ?? "0", 10);
  const tipCents = parseInt(searchParams.get("tipCents") ?? "0", 10);
  const source = searchParams.get("source") ?? "qr"; // "qr" | "tip"

  const [cashapp, setCashapp] = useState<CashAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    fetch(`/api/cashapp/public-settings?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setCashapp(d);
        setLoading(false);
      })
      .catch(() => {
        setCashapp({ cashappEnabled: false });
        setLoading(false);
      });
  }, [slug]);

  const handleCreditCard = async () => {
    setSelecting(true);
    // Route back to the appropriate Stripe flow
    if (source === "tip") {
      // Came from the tip page — call stripe/tip-checkout
      const res = await fetch("/api/stripe/tip-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          tipAmountCents: tipCents,
          businessId: cashapp?.businessId,
          slug,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSelecting(false);
        alert(data.error ?? "Something went wrong. Please try again.");
      }
    } else {
      // Came from pay-qr — call stripe/pay-with-tip
      const res = await fetch("/api/stripe/pay-with-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          serviceCents,
          tipCents,
          businessId: cashapp?.businessId,
          slug,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSelecting(false);
        alert(data.error ?? "Something went wrong. Please try again.");
      }
    }
  };

  const handleCashApp = () => {
    const params = new URLSearchParams({
      bookingId: bookingId ?? "",
      serviceCents: String(serviceCents),
      tipCents: String(tipCents),
      source,
    });
    router.push(`/${slug}/cashapp-pay?${params.toString()}`);
  };

  const totalCents = serviceCents + tipCents;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  // If Cash App is not enabled, skip straight to credit card
  if (!cashapp?.cashappEnabled) {
    handleCreditCard();
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💳</div>
          <h1 className="text-2xl font-bold text-gray-900">How would you like to pay?</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Total: <span className="font-bold text-gray-800">${(totalCents / 100).toFixed(2)}</span>
            {tipCents > 0 && (
              <span className="text-gray-400 ml-1">(includes ${(tipCents / 100).toFixed(2)} tip)</span>
            )}
          </p>
        </div>

        {/* Payment Options */}
        <div className="space-y-4">
          {/* Cash App Option */}
          <button
            onClick={handleCashApp}
            disabled={selecting}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-green-400 bg-green-50 hover:bg-green-100 active:scale-95 transition disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-900 text-base">Pay with Cash App</p>
              <p className="text-sm text-green-700 mt-0.5">
                {cashapp.feeMode === "pass_to_customer"
                  ? "Includes $1.00 platform fee"
                  : "No extra fees"}
              </p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Credit Card Option */}
          <button
            onClick={handleCreditCard}
            disabled={selecting}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-900 text-base">Pay with Credit Card</p>
              <p className="text-sm text-gray-500 mt-0.5">Secure checkout via Stripe</p>
            </div>
            {selecting && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            )}
            {!selecting && (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your payment is secure and encrypted
        </p>
      </div>
    </div>
  );
}
