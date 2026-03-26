"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PaySuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push(`/${slug}/dashboard`);
      return;
    }
    confirmPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const confirmPayment = async () => {
    try {
      const res = await fetch("/api/stripe/confirm-service-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slug }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus("error");
        return;
      }

      if (data.referralCode) setReferralCode(data.referralCode);
      setStatus("success");
    } catch (err) {
      console.error("Payment confirmation error:", err);
      setStatus("error");
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">
                Confirming your payment...
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Please don&apos;t close this page
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900">
                Payment Complete!
              </h2>
              <p className="text-gray-600 mt-3 mb-8">
                Thank you! We appreciate your business.
              </p>
              <Link
                href={`/${slug}/dashboard`}
                className="block w-full bg-blue-600 text-white py-4 rounded-xl font-semibold"
              >
                Back to Home
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-xl font-bold text-gray-900">
                Something went wrong
              </h2>
              <p className="text-gray-600 mt-2 text-sm">
                Your payment was processed but we had trouble confirming it.
                Please contact the business.
              </p>
              <Link
                href={`/${slug}/dashboard`}
                className="block mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                Go Home
              </Link>
            </>
          )}
        </div>

        {/* Referral Card — shown after successful payment */}
        {status === "success" && referralCode && (
          <>
            <style>{`
              @keyframes referralWobble {
                0%   { transform: translateX(0) rotate(0deg); }
                6%   { transform: translateX(-10px) rotate(-2.5deg); }
                12%  { transform: translateX(10px) rotate(2.5deg); }
                18%  { transform: translateX(-8px) rotate(-2deg); }
                24%  { transform: translateX(8px) rotate(2deg); }
                30%  { transform: translateX(-4px) rotate(-1deg); }
                36%  { transform: translateX(4px) rotate(1deg); }
                42%  { transform: translateX(0) rotate(0deg); }
                100% { transform: translateX(0) rotate(0deg); }
              }
              .referral-card {
                animation: referralWobble 5s ease-in-out infinite;
              }
            `}</style>
            <div
              className="referral-card rounded-2xl shadow-lg p-6 text-white"
              style={{ background: "linear-gradient(135deg, #9333ea, #4f46e5, #7c3aed, #4338ca)" }}
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎁</div>
                <h3 className="text-xl font-bold">Refer Friends, Earn Rewards!</h3>
                <p className="text-purple-100 text-sm mt-2">
                  Share your link with friends. When they book using your link,
                  you both earn points toward free or discounted services!
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4 text-center">
                <p className="text-white font-semibold text-sm mb-3">
                  Your referral link and QR code are located in the MY Page section of your app
                </p>
                <Link
                  href={`/${slug}/dashboard`}
                  className="inline-block w-full py-3 bg-white text-purple-700 rounded-xl text-sm font-bold active:scale-95 transition shadow"
                >
                  Click here to see it
                </Link>
              </div>

              <p className="text-purple-100 text-xs text-center font-medium">
                Make sure your friend scans your QR code or uses your link when
                they book — otherwise the referral won&apos;t count!
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
