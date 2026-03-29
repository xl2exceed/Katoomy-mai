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
    .select("cashtag, phone_number, qr_code_url, fee_mode, enabled")
    .eq("business_id", business.id)
    .maybeSingle();

  if (!settings || !settings.enabled) {
    return NextResponse.json({ cashappEnabled: false });
  }

  return NextResponse.json({
    cashappEnabled: true,
    cashtag: settings.cashtag,
    phoneNumber: settings.phone_number,
    qrCodeUrl: settings.qr_code_url,
    feeMode: settings.fee_mode,
    businessId: business.id,
    businessName: business.name,
  });
}
