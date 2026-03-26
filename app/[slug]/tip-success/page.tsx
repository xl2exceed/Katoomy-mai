"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function TipSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [tipDollars, setTipDollars] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      router.push(`/${slug}/dashboard`);
      return;
    }
    confirmTip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const confirmTip = async () => {
    try {
      const res = await fetch("/api/stripe/confirm-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slug }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || "Something went wrong");
        setStatus("error");
        return;
      }

      setTipDollars((data.amountCents / 100).toFixed(2));
      setStatus("success");
    } catch (err) {
      console.error("Tip confirmation error:", err);
      setErrorMessage("Failed to confirm your tip. Your payment was still processed.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-sm w-full">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Confirming your tip...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-6xl mb-4">💝</div>
            <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
            {tipDollars && (
              <p className="text-3xl font-bold text-blue-600 mt-2">${tipDollars}</p>
            )}
            <p className="text-gray-600 mt-3 mb-8">
              Your tip means the world to us. See you next time!
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
            <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-gray-600 mt-2 text-sm">{errorMessage}</p>
            <Link
              href={`/${slug}/dashboard`}
              className="block mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Go Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
