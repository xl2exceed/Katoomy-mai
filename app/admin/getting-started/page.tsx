"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type StatusData = {
  completed: boolean;
  niche: string;
  branding: boolean;
  availability: boolean;
  services: boolean;
  nicheSettings: boolean | null;
  paymentSetup: boolean;
  paymentSettings: boolean;
};

type SkipState = {
  paymentSetup: boolean;
  paymentSettings: boolean;
};

type StepConfig = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  href: string;
  tooltip: string;
  done: boolean;
  canSkip: boolean;
  skipKey?: keyof SkipState;
};

export default function GettingStartedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [skipped, setSkipped] = useState<SkipState>({ paymentSetup: false, paymentSettings: false });
  const [fetching, setFetching] = useState(false);

  const fetchStatus = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/onboarding-status");
      const data: StatusData = await res.json();
      if (data.completed) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setStatus(data);
    } catch {}
    setFetching(false);
  }, [router]);

  useEffect(() => {
    // Load skipped state from localStorage
    try {
      const stored = localStorage.getItem("onboarding-skipped");
      if (stored) setSkipped(JSON.parse(stored));
    } catch {}

    fetchStatus();
  }, [fetchStatus]);

  // Re-fetch when the user returns to this tab after visiting a setup page
  useEffect(() => {
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStatus]);

  const toggleSkip = (key: keyof SkipState) => {
    setSkipped((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("onboarding-skipped", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCarwash = status.niche === "carwash";
  const isLawnCare = status.niche === "lawn_care";

  const steps: StepConfig[] = [
    {
      id: "branding",
      icon: "🎨",
      title: "Branding",
      desc: "Upload your logo, set your business name, address, and customize your booking link and app appearance.",
      href: "/admin/branding",
      tooltip: "Opens the Branding page — upload your logo, set your business name and address, choose your app colors, and get your shareable booking link and QR code.",
      done: status.branding,
      canSkip: false,
    },
    {
      id: "availability",
      icon: "🕒",
      title: "Availability",
      desc: "Set your working hours so customers only see time slots when you're open.",
      href: "/admin/availability",
      tooltip: "Opens Availability — set the days and hours you're available so customers can only book during your actual working schedule.",
      done: status.availability,
      canSkip: false,
    },
    {
      id: "services",
      icon: isCarwash ? "🚗" : isLawnCare ? "🌿" : "✂️",
      title: "Services",
      desc: "Add the services you offer with pricing and duration. Customers choose from these when they book.",
      href: "/admin/services",
      tooltip: "Opens Services — add the services you offer, set the price and duration for each, and manage which services are available for booking.",
      done: status.services,
      canSkip: false,
    },
    ...(status.nicheSettings !== null
      ? [
          {
            id: "biz-settings",
            icon: isCarwash ? "⚙️" : "🌿",
            title: isCarwash ? "Car Wash Settings" : "Lawn Care Settings",
            desc: isCarwash
              ? "Configure your vehicle types, service packages, and available add-ons."
              : "Set your service radius, travel fees, and property size surcharges.",
            href: isCarwash ? "/admin/carwash" : "/admin/lawncare",
            tooltip: isCarwash
              ? "Opens Car Wash Settings — configure the vehicle types you service, your package tiers, and any add-on options customers can select at booking."
              : "Opens Lawn Care Settings — set your maximum service radius, whether you charge travel fees, and pricing adjustments based on property size.",
            done: status.nicheSettings === true,
            canSkip: false,
          } as StepConfig,
        ]
      : []),
    {
      id: "payment-setup",
      icon: "💰",
      title: "Payment Setup",
      desc: "Connect Stripe to accept online card payments, or configure Cash App and Zelle for manual payments.",
      href: "/admin/stripe",
      tooltip: "Opens Payment Setup — connect a Stripe account to accept credit/debit card payments online, or configure Cash App and Zelle so customers know how to pay you directly.",
      done: status.paymentSetup,
      canSkip: true,
      skipKey: "paymentSetup",
    },
    {
      id: "payment-settings",
      icon: "💵",
      title: "Payment Settings",
      desc: "Choose whether to require a deposit at booking and set your deposit amount.",
      href: "/admin/payment-settings",
      tooltip: "Opens Payment Settings — decide if you want to require a deposit when customers book, and set the deposit amount or percentage.",
      done: status.paymentSettings,
      canSkip: true,
      skipKey: "paymentSettings",
    },
  ];

  const getState = (step: StepConfig): "done" | "skipped" | "pending" => {
    if (step.done) return "done";
    if (step.canSkip && step.skipKey && skipped[step.skipKey]) return "skipped";
    return "pending";
  };

  const allReady = steps.every((s) => {
    const st = getState(s);
    return s.canSkip ? st !== "pending" : st === "done";
  });

  const progressCount = steps.filter((s) => getState(s) !== "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Katoomy</h1>
          <p className="text-gray-500 mt-1">
            Complete these steps to get your business ready to accept bookings.
          </p>
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(progressCount / steps.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1.5">
            {progressCount} of {steps.length} steps complete
            {fetching && (
              <span className="ml-2 inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin align-middle" />
            )}
          </p>
        </div>

        {/* Step cards */}
        <div className="space-y-3">
          {steps.map((step) => {
            const state = getState(step);
            return (
              <div
                key={step.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-colors ${
                  state === "done"
                    ? "border-green-200 bg-green-50/30"
                    : state === "skipped"
                    ? "border-yellow-200 bg-yellow-50/30"
                    : "border-gray-200"
                }`}
              >
                {/* Status icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base mt-0.5 ${
                    state === "done"
                      ? "bg-green-100 text-green-600"
                      : state === "skipped"
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {state === "done" ? "✓" : state === "skipped" ? "—" : step.icon}
                </div>

                {/* Text + skip control */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    {state === "done" && (
                      <span className="text-xs text-green-600 font-medium">Complete</span>
                    )}
                    {state === "skipped" && (
                      <span className="text-xs text-yellow-600 font-medium">Skipped — Cash Only</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 leading-snug">{step.desc}</p>

                  {step.canSkip && state === "pending" && (
                    <button
                      type="button"
                      onClick={() => step.skipKey && toggleSkip(step.skipKey)}
                      className="mt-2 text-xs text-gray-400 hover:text-yellow-600 underline transition"
                    >
                      Not Now — I&apos;ll collect payment in person
                    </button>
                  )}
                  {step.canSkip && state === "skipped" && (
                    <button
                      type="button"
                      onClick={() => step.skipKey && toggleSkip(step.skipKey)}
                      className="mt-2 text-xs text-yellow-600 hover:text-gray-500 underline transition"
                    >
                      Undo — I want to set this up
                    </button>
                  )}
                </div>

                {/* Action button */}
                <Link
                  href={step.href}
                  title={step.tooltip}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    state === "done"
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : state === "skipped"
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-sm"
                  }`}
                >
                  {state === "done" ? "Edit" : state === "skipped" ? "Set Up" : "Set Up →"}
                </Link>
              </div>
            );
          })}
        </div>

        {/* CTA — always visible, enabled only when ready */}
        <div className="mt-8 text-center">
          {allReady ? (
            <>
              <p className="text-sm text-green-600 font-medium mb-3">
                ✓ All steps complete — you&apos;re ready to go!
              </p>
              <Link
                href="/admin/onboarding-complete"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:from-purple-700 hover:to-indigo-700 transition text-base"
              >
                Continue to Dashboard →
              </Link>
            </>
          ) : (
            <>
              <div
                title="Complete all required steps above to continue"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-200 text-gray-400 font-semibold rounded-xl text-base cursor-not-allowed select-none"
              >
                Continue to Dashboard →
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Complete all required steps above to continue.
                {steps.some((s) => s.canSkip && getState(s) === "pending") && (
                  <> Payment steps can be skipped if you take cash.</>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
