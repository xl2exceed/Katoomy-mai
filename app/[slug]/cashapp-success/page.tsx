"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const METHOD_LABELS: Record<string, string> = {
  cash_app: "Cash App",
  zelle: "Zelle",
  cash: "cash",
};

export default function CashAppSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const totalCents = parseInt(searchParams.get("totalCents") ?? "0", 10);
  const businessName = searchParams.get("businessName") ?? "the business";
  const referralCode = searchParams.get("referralCode");
  const paymentMethod = searchParams.get("paymentMethod") ?? "";
  const methodLabel = METHOD_LABELS[paymentMethod] ?? "payment";
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push(`/${slug}/dashboard`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [slug, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Sent!</h1>
          <p className="text-gray-600 text-sm mb-1">
            Your {methodLabel} payment of{" "}
            <span className="font-bold text-gray-900">${(totalCents / 100).toFixed(2)}</span>{" "}
            has been submitted.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Thank you for visiting {businessName}. Staff will confirm your payment shortly.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-green-800 font-medium">
              Payment recorded! Show staff your screen if needed.
            </p>
          </div>

          <Link
            href={`/${slug}/dashboard`}
            className="block w-full bg-blue-600 text-white py-4 rounded-xl font-semibold"
          >
            Back to Home
          </Link>
          <p className="text-gray-400 text-xs mt-3">
            Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
          </p>
        </div>

        {/* Referral Card */}
        {referralCode && (
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
                <div className="text-4xl mb-2">&#127873;</div>
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
                they book &mdash; otherwise the referral won&apos;t count!
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
