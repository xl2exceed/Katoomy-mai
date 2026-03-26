"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Plan = "pro" | "premium" | null;
type Interval = "monthly" | "annual" | null;

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const [countdown, setCountdown] = useState(5);
  const [plan, setPlan] = useState<Plan>(null);
  const [interval, setInterval] = useState<Interval>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(!!sessionId);

  const label = useMemo(() => {
    const p = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Your Plan";
    const i =
      interval === "annual"
        ? "Annual"
        : interval === "monthly"
          ? "Monthly"
          : "";
    return i ? `${p} (${i})` : p;
  }, [plan, interval]);

  // Fetch what plan was purchased (optional, but helps the UI)
  useEffect(() => {
    const run = async () => {
      if (!sessionId) {
        setLoadingPlan(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/stripe/checkout-session?session_id=${encodeURIComponent(
            sessionId,
          )}`,
        );
        const json = await res.json();

        if (res.ok) {
          setPlan((json.plan as Plan) ?? null);
          setInterval((json.interval as Interval) ?? null);
        } else {
          console.error("Plan lookup failed:", json);
        }
      } catch (e) {
        console.error("Plan lookup error:", e);
      } finally {
        setLoadingPlan(false);
      }
    };

    run();
  }, [sessionId]);

  // Countdown tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Redirect ONLY in useEffect (fixes Router warning)
  useEffect(() => {
    if (countdown === 0) {
      router.push("/admin");
    }
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 Welcome to {loadingPlan ? "your new plan" : label}!
        </h1>

        <p className="text-lg text-gray-600 mb-6">
          Your upgrade was successful!{" "}
          {loadingPlan
            ? "Finalizing your account..."
            : `Access granted to ${label}.`}
        </p>

        {sessionId && (
          <p className="text-xs text-gray-400 mb-6">Session ID: {sessionId}</p>
        )}

        <p className="text-sm text-gray-500 mb-4">
          Redirecting to dashboard in {countdown} seconds...
        </p>

        <Link
          href="/admin"
          className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition"
        >
          Go to Dashboard Now
        </Link>

        <p className="text-sm text-gray-500 mt-6">
          A receipt has been sent to your email
        </p>
      </div>
    </div>
  );
}
