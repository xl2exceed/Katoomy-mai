// file: app/admin/layout.tsx

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Sidebar from "./_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AiHelpWidget from "@/components/AiHelpWidget";

export const runtime = "nodejs";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // Skip auth check on login pages
  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/mobile/login")
  ) {
    return <>{children}</>;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/admin/mobile")) {
      redirect("/admin/mobile/login");
    } else {
      redirect("/admin/login");
    }
  }

  let plan = "free";
  let status: string | null = null;
  let businessId = "";
  let niche = "barber";
  let onboardingCompleted = true; // default true — protects existing users before migration runs
  let logoUrl: string | null = null;

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, subscription_plan, subscription_status, features, logo_url, onboarding_completed")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (biz) {
    businessId = biz.id;
    plan = biz.subscription_plan ?? "free";
    status = biz.subscription_status ?? null;
    const features = biz.features as Record<string, unknown> | null;
    niche = (features?.niche as string) ?? "barber";
    logoUrl = biz.logo_url ?? null;
    // null = column not yet added (pre-migration) → treat as completed so existing users aren't disrupted
    onboardingCompleted = biz.onboarding_completed ?? true;
  }

  // Default dots — all false until queried
  let dots = {
    services: false,
    availability: false,
    branding: false,
    paymentSetup: false,
    paymentSettings: false,
    staff: false,
    campaigns: false,
    rewards: false,
    membership: false,
    network: false,
  };

  if (businessId) {
    const [
      { count: serviceCount },
      { data: availData },
      { data: stripeData },
      { count: staffCount },
      { data: loyaltyData },
      { count: partnerCount },
      { count: membershipCount },
      { data: cashAppData },
      { count: campaignCount },
      { data: depositData },
    ] = await Promise.all([
      supabaseAdmin.from("services").select("*", { count: "exact", head: true }).eq("business_id", businessId),
      supabaseAdmin.from("availability_rules").select("id").eq("business_id", businessId).maybeSingle(),
      supabaseAdmin.from("stripe_connect_accounts").select("business_id").eq("business_id", businessId).maybeSingle(),
      supabaseAdmin.from("staff").select("*", { count: "exact", head: true }).eq("business_id", businessId),
      supabaseAdmin.from("loyalty_settings").select("enabled").eq("business_id", businessId).maybeSingle(),
      supabaseAdmin.from("network_partners").select("*", { count: "exact", head: true }).or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`).eq("status", "active"),
      supabaseAdmin.from("membership_plans").select("*", { count: "exact", head: true }).eq("business_id", businessId),
      supabaseAdmin.from("cashapp_settings").select("business_id").eq("business_id", businessId).maybeSingle(),
      supabaseAdmin.from("sms_campaigns").select("*", { count: "exact", head: true }).eq("business_id", businessId),
      supabaseAdmin.from("deposit_settings").select("business_id").eq("business_id", businessId).maybeSingle(),
    ]);

    dots = {
      services:        (serviceCount ?? 0) > 0,
      availability:    !!availData,
      branding:        !!logoUrl,
      paymentSetup:    !!stripeData,
      paymentSettings: !!cashAppData,
      staff:           (staffCount ?? 0) > 0,
      campaigns:       (campaignCount ?? 0) > 0,
      rewards:         loyaltyData?.enabled === true,
      membership:      (membershipCount ?? 0) > 0,
      network:         (partnerCount ?? 0) > 0,
    };
  }

  // Mobile routes render without the desktop sidebar.
  if (pathname.startsWith("/admin/mobile")) {
    return <>{children}</>;
  }

  // New users: redirect /admin overview to the setup checklist
  if (!onboardingCompleted && pathname === "/admin") {
    redirect("/admin/getting-started");
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        businessId={businessId}
        plan={plan}
        status={status}
        niche={niche}
        onboardingCompleted={onboardingCompleted}
        dots={dots}
      />
      <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      <AiHelpWidget portal="admin-desktop" />
    </div>
  );
}
