// GET /api/cashapp/settings — fetch business Cash App settings
// POST /api/cashapp/settings — save/update Cash App settings
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: settings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();

  return NextResponse.json({ settings: settings ?? null, businessId: business.id });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const { cashtag, phone_number, qr_code_url, fee_mode, enabled, zelle_enabled, zelle_phone, zelle_email } = body;

  const upsertData = {
    business_id: business.id,
    cashtag: cashtag ?? null,
    phone_number: phone_number ?? null,
    qr_code_url: qr_code_url ?? null,
    fee_mode: fee_mode ?? "pass_to_customer",
    enabled: enabled ?? false,
    zelle_enabled: zelle_enabled ?? false,
    zelle_phone: zelle_phone ?? null,
    zelle_email: zelle_email ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("cashapp_settings")
    .upsert(upsertData, { onConflict: "business_id" })
    .select()
    .single();

  if (error) {
    console.error("[cashapp/settings] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}
