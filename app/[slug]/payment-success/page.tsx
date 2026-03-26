// file: app/[slug]/payment-success/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      router.push(`/${slug}/services`);
      return;
    }
    processPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const processPayment = async () => {
    try {
      const res = await fetch("/api/stripe/confirm-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slug }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus("error");
        setMessage(data.error || "Something went wrong");
        return;
      }

      // Store booking ID for confirmation page
      sessionStorage.setItem("bookingId", data.bookingId);
      setStatus("success");

      // Redirect to confirmation after brief success flash
      setTimeout(() => {
        router.push(`/${slug}/confirmation`);
      }, 1500);
    } catch (err) {
      console.error("Payment confirmation error:", err);
      setStatus("error");
      setMessage(
        "Failed to confirm your booking. Please contact the business.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            <h2 className="text-xl font-bold text-gray-900">
              Payment Successful!
            </h2>
            <p className="text-gray-600 mt-2">
              Your appointment is confirmed. Redirecting...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900">
              Something went wrong
            </h2>
            <p className="text-gray-600 mt-2 text-sm">{message}</p>
            <button
              onClick={() => router.push(`/${slug}/services`)}
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
