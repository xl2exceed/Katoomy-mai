import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business, error } = await supabaseAdmin
    .from("businesses")
    .select("id, features")
    .eq("owner_user_id", user.id)
    .single();

  if (error || !business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const features = (business.features as Record<string, string>) || {};
  return NextResponse.json({
    niche: features.niche || "barber",
    service_mode: features.service_mode || "in_shop",
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { niche, service_mode } = await req.json();

  const validNiches = ["barber", "carwash"];
  const validModes = ["in_shop", "mobile", "hybrid"];
  if (!validNiches.includes(niche)) {
    return NextResponse.json({ error: "Invalid niche" }, { status: 400 });
  }
  if (niche === "carwash" && !validModes.includes(service_mode)) {
    return NextResponse.json({ error: "Invalid service_mode" }, { status: 400 });
  }

  // Fetch current features to merge (don't overwrite other flags)
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, features")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const currentFeatures = (business.features as Record<string, string>) || {};
  const updatedFeatures: Record<string, string> = {
    ...currentFeatures,
    niche,
    ...(niche === "carwash" ? { service_mode } : {}),
  };

  // If switching back to barber, remove carwash-specific keys
  if (niche === "barber") {
    delete updatedFeatures.service_mode;
  }

  const { error: updateError } = await supabaseAdmin
    .from("businesses")
    .update({ features: updatedFeatures })
    .eq("id", business.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If switching to carwash, ensure a carwash_settings row exists
  if (niche === "carwash") {
    await supabaseAdmin
      .from("carwash_settings")
      .upsert(
        { business_id: business.id, service_mode },
        { onConflict: "business_id" }
      );
  }

  return NextResponse.json({ success: true, niche, service_mode });
}
