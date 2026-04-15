// GET /api/cashapp/public-settings?slug=<slug>
// Public (no auth) — returns Cash App settings for the customer-facing payment page.
// Only returns enabled settings; does not expose sensitive business data.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: settings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("cashtag, phone_number, fee_mode, enabled, zelle_enabled, zelle_phone, zelle_email")
    .eq("business_id", business.id)
    .maybeSingle();

  const cashappEnabled = !!(settings?.enabled && settings?.cashtag);
  const zelleEnabled = !!(settings?.zelle_enabled && (settings?.zelle_phone || settings?.zelle_email));

  if (!cashappEnabled && !zelleEnabled) {
    return NextResponse.json({ cashappEnabled: false, zelleEnabled: false, businessId: business.id });
  }

  return NextResponse.json({
    cashappEnabled,
    zelleEnabled,
    cashtag: settings?.cashtag ?? null,
    feeMode: settings?.fee_mode ?? "pass_to_customer",
    zellePhone: settings?.zelle_phone ?? null,
    zelleEmail: settings?.zelle_email ?? null,
    businessId: business.id,
    businessName: business.name,
  });
}
