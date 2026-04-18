// file: app/admin/layout.tsx

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Sidebar from "./_components/Sidebar";
import { createClient } from "@/lib/supabase/server";
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
    // Mobile routes go to mobile login, desktop routes go to desktop login
    if (pathname.startsWith("/admin/mobile")) {
      redirect("/admin/mobile/login");
    } else {
      redirect("/admin/login");
    }
  }

  let plan = "free";
  let status: string | null = null;
  let businessId = "";
  let niche = "barber"; // default niche

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, subscription_plan, subscription_status, features")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (biz) {
    businessId = biz.id;
    plan = biz.subscription_plan ?? "free";
    status = biz.subscription_status ?? null;
    const features = biz.features as Record<string, unknown> | null;
    niche = (features?.niche as string) ?? "barber";
  }

  // Mobile routes render without the desktop sidebar
  if (pathname.startsWith("/admin/mobile")) {
    return (
      <>
        {children}
        <AiHelpWidget />
      </>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar businessId={businessId} plan={plan} status={status} niche={niche} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <AiHelpWidget />
    </div>
  );
}
