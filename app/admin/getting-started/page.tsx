// app/admin/getting-started/page.tsx
// Setup checklist for new businesses. Auto-detects completion of each step.
// Redirects to /admin once onboarding_completed is true.

export const runtime = "nodejs";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function GettingStartedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, features, logo_url, onboarding_completed")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!biz) redirect("/admin/login");
  if (biz.onboarding_completed) redirect("/admin");

  const features = biz.features as Record<string, unknown> | null;
  const niche = (features?.niche as string) ?? "barber";
  const isCarwash = niche === "carwash";
  const isLawnCare = niche === "lawn_care";
  const hasNicheSettings = isCarwash || isLawnCare;

  const [
    { data: availData },
    { count: serviceCount },
    { data: stripeData },
    { data: cashAppData },
    { data: depositData },
    { data: nicheData },
  ] = await Promise.all([
    supabaseAdmin.from("availability_rules").select("id").eq("business_id", biz.id).maybeSingle(),
    supabaseAdmin.from("services").select("*", { count: "exact", head: true }).eq("business_id", biz.id),
    supabaseAdmin.from("stripe_connect_accounts").select("business_id").eq("business_id", biz.id).maybeSingle(),
    supabaseAdmin.from("cashapp_settings").select("business_id").eq("business_id", biz.id).maybeSingle(),
    supabaseAdmin.from("deposit_settings").select("business_id").eq("business_id", biz.id).maybeSingle(),
    isCarwash
      ? supabaseAdmin.from("carwash_settings").select("business_id").eq("business_id", biz.id).maybeSingle()
      : isLawnCare
      ? supabaseAdmin.from("lawn_care_settings").select("business_id").eq("business_id", biz.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  type Step = {
    id: string;
    icon: string;
    title: string;
    desc: string;
    href: string;
    done: boolean;
  };

  const steps: Step[] = [
    {
      id: "branding",
      icon: "🎨",
      title: "Branding",
      desc: "Upload your logo and set your business name, address, and shareable booking link. Your customers see this when they book.",
      href: "/admin/branding",
      done: !!biz.logo_url,
    },
    {
      id: "availability",
      icon: "🕒",
      title: "Availability",
      desc: "Set your working hours so customers only see time slots when you're actually open.",
      href: "/admin/availability",
      done: !!availData,
    },
    {
      id: "services",
      icon: isCarwash ? "🚗" : isLawnCare ? "🌿" : "✂️",
      title: "Services",
      desc: "Add the services you offer with pricing and duration. Customers choose from these when they book.",
      href: "/admin/services",
      done: (serviceCount ?? 0) > 0,
    },
    ...(hasNicheSettings
      ? [
          {
            id: "biz-settings",
            icon: isCarwash ? "⚙️" : "🌿",
            title: isCarwash ? "Car Wash Settings" : "Lawn Care Settings",
            desc: isCarwash
              ? "Configure your vehicle types, service packages, and available add-ons."
              : "Set your service radius, travel fees, and property size surcharges.",
            href: isCarwash ? "/admin/carwash" : "/admin/lawncare",
            done: !!nicheData,
          } as Step,
        ]
      : []),
    {
      id: "payment-setup",
      icon: "💰",
      title: "Payment Setup",
      desc: "Connect Stripe to accept online card payments, or configure Cash App and Zelle for manual payments.",
      href: "/admin/stripe",
      done: !!stripeData || !!cashAppData,
    },
    {
      id: "payment-settings",
      icon: "💵",
      title: "Payment Settings",
      desc: "Choose whether to require a deposit at booking and set your deposit amount.",
      href: "/admin/payment-settings",
      done: !!depositData,
    },
  ];

  const allDone = steps.every((s) => s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Katoomy</h1>
          <p className="text-gray-500 mt-1">
            Complete these steps to get your business ready to accept bookings.
          </p>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1.5">
            {doneCount} of {steps.length} steps complete
          </p>
        </div>

        {/* Step cards */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition ${
                step.done ? "border-green-200" : "border-gray-200"
              }`}
            >
              {/* Icon / checkmark */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base mt-0.5 ${
                  step.done
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {step.done ? "✓" : step.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{step.title}</p>
                  {step.done && (
                    <span className="text-xs text-green-600 font-medium flex-shrink-0">
                      Complete
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                  {step.desc}
                </p>
              </div>

              {/* CTA */}
              <Link
                href={step.href}
                className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  step.done
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-sm"
                }`}
              >
                {step.done ? "Edit" : "Set Up"}
              </Link>
            </div>
          ))}
        </div>

        {/* Finish Setup / completion prompt */}
        <div className="mt-8 text-center">
          {allDone ? (
            <Link
              href="/admin/onboarding-complete"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:from-purple-700 hover:to-indigo-700 transition text-base"
            >
              Finish Setup →
            </Link>
          ) : (
            <p className="text-sm text-gray-400">
              Complete all steps above to finish setup.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
