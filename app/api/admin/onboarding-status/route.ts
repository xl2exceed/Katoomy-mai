// GET /api/admin/onboarding-status
// Returns live step-completion statuses for the getting-started checklist.
// Called by the client component on mount and on window focus.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, features, branding_completed, onboarding_completed")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already finished onboarding — tell the client to redirect
  if (biz.onboarding_completed) {
    return NextResponse.json({ completed: true });
  }

  const features = biz.features as Record<string, unknown> | null;
  const niche = (features?.niche as string) ?? "barber";
  const isCarwash = niche === "carwash";
  const isLawnCare = niche === "lawn_care";

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

  return NextResponse.json({
    completed:       false,
    niche,
    branding:        biz.branding_completed ?? false,
    availability:    !!availData,
    services:        (serviceCount ?? 0) > 0,
    nicheSettings:   (isCarwash || isLawnCare) ? !!nicheData : null,
    paymentSetup:    !!stripeData || !!cashAppData,
    paymentSettings: !!depositData,
  });
}
