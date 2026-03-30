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

export default function CashAppPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const bookingId = searchParams.get("bookingId");
  const serviceCents = parseInt(searchParams.get("serviceCents") ?? "0", 10);
  const tipCents = parseInt(searchParams.get("tipCents") ?? "0", 10);

  const [cashapp, setCashapp] = useState<CashAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetch(`/api/cashapp/public-settings?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setCashapp(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [slug]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePaymentSent = async () => {
    setClaiming(true);
    try {
      const res = await fetch("/api/cashapp/customer-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, totalCents }),
      });
      const data = await res.json();
      const qs = new URLSearchParams({
        totalCents: String(totalCents),
        businessName: cashapp?.businessName ?? "",
      });
      if (data.referralCode) qs.set("referralCode", data.referralCode);
      router.push(`/${slug}/cashapp-success?${qs.toString()}`);
    } catch {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!cashapp?.cashappEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-gray-700 font-medium">Cash App payments are not available for this business.</p>
          <p className="text-gray-500 text-sm mt-2">Please go back and choose a different payment method.</p>
        </div>
      </div>
    );
  }

  const platformFeeCents = cashapp.feeMode === "pass_to_customer" ? 100 : 0;
  const totalCents = serviceCents + tipCents + platformFeeCents;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pay with Cash App</h1>
          {cashapp.businessName && (
            <p className="text-gray-500 mt-1 text-sm">{cashapp.businessName}</p>
          )}
        </div>

        {/* Amount Breakdown */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Service</span>
            <span>${(serviceCents / 100).toFixed(2)}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>
          )}
          {platformFeeCents > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Platform fee</span>
              <span>${(platformFeeCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total to send</span>
            <span className="text-green-700 text-lg">${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* QR Code */}
        {cashapp.qrCodeUrl && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
              Scan QR code with Cash App
            </p>
            <div className="flex justify-center">
              <div className="border-4 border-green-500 rounded-2xl p-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cashapp.qrCodeUrl}
                  alt="Cash App QR Code"
                  className="w-48 h-48 object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        {cashapp.qrCodeUrl && (cashapp.cashtag || cashapp.phoneNumber) && (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR SEND MANUALLY</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Cashtag / Phone */}
        {(cashapp.cashtag || cashapp.phoneNumber) && (
          <div className="space-y-3 mb-6">
            {cashapp.cashtag && (
              <button
                onClick={() => handleCopy(cashapp.cashtag!)}
                className="w-full flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition active:scale-95"
              >
                <div className="text-left">
                  <p className="text-xs text-gray-500 font-medium">Cash App Cashtag</p>
                  <p className="text-base font-bold text-green-700">{cashapp.cashtag}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Tap to copy
                    </>
                  )}
                </div>
              </button>
            )}
            {cashapp.phoneNumber && (
              <button
                onClick={() => handleCopy(cashapp.phoneNumber!)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition active:scale-95"
              >
                <div className="text-left">
                  <p className="text-xs text-gray-500 font-medium">Phone Number</p>
                  <p className="text-base font-bold text-gray-800">{cashapp.phoneNumber}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Tap to copy
                </div>
              </button>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
          <p className="text-sm text-blue-800 font-semibold mb-1">How to pay:</p>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Open your Cash App</li>
            <li>Scan the QR code above {cashapp.phoneNumber ? "or search by phone number" : ""}</li>
            <li>Send exactly <strong>${(totalCents / 100).toFixed(2)}</strong></li>
            <li>Show the confirmation to staff</li>
          </ol>
        </div>

        <p className="text-center text-xs text-gray-400 mb-6">
          Staff will confirm your payment and complete your checkout
        </p>

        {/* Payment Sent Button */}
        <button
          onClick={handlePaymentSent}
          disabled={claiming}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
        >
          {claiming ? (
            <>
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              I&apos;ve Sent the Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
