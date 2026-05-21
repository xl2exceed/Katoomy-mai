// GET  /api/lawncare/settings?businessId=...  — public read (for booking flow)
// POST /api/lawncare/settings                 — owner upsert
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("lawn_care_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, features")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const {
    service_radius_miles = 25,
    travel_fee_enabled = false,
    travel_fee_type = "flat",
    travel_fee_flat_cents = 0,
    travel_fee_per_mile_cents = 0,
    property_surcharges = { small: 0, medium: 0, large: 0, xl: 0 },
  } = body;

  const { data, error } = await supabaseAdmin
    .from("lawn_care_settings")
    .upsert(
      {
        business_id: business.id,
        service_radius_miles,
        travel_fee_enabled,
        travel_fee_type,
        travel_fee_flat_cents,
        travel_fee_per_mile_cents,
        property_surcharges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge niche into businesses.features
  const currentFeatures = (business.features as Record<string, unknown>) || {};
  await supabaseAdmin
    .from("businesses")
    .update({ features: { ...currentFeatures, niche: "lawn_care" } })
    .eq("id", business.id);

  return NextResponse.json(data);
}
