"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function MembershipSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }
    confirmMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const confirmMembership = async () => {
    try {
      const res = await fetch("/api/memberships/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slug }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">Setting up your membership...</p>
              <p className="text-gray-500 text-sm mt-1">Please don&apos;t close this page</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-6xl mb-4">⭐</div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome to Elite Membership!</h2>
              <p className="text-gray-600 mt-3 mb-2">
                Your membership is now active. Your discount will be applied automatically every time you book.
              </p>
              <div className="bg-blue-50 rounded-xl p-4 my-6">
                <p className="text-blue-800 text-sm font-semibold">
                  🎉 You&apos;re now a member. Enjoy your discount on every visit!
                </p>
              </div>
              <Link
                href={`/${slug}/dashboard`}
                className="block w-full bg-blue-600 text-white py-4 rounded-xl font-semibold"
              >
                Go to My Dashboard
              </Link>
              <Link
                href={`/${slug}/book`}
                className="block w-full mt-3 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm"
              >
                Book an Appointment
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
              <p className="text-gray-600 mt-2 text-sm">
                Your payment may have gone through but we had trouble confirming your membership.
                Please contact the business or try viewing your membership status.
              </p>
              <Link
                href={`/${slug}/membership`}
                className="block mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                Check Membership Status
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
