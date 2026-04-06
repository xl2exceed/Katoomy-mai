import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, slug, features")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, business_id, start_ts, status, payment_status, total_price_cents, deposit_amount_cents, customer_notes, vehicle_type, vehicle_condition, customer_address, addon_ids, customers(full_name, phone), staff(full_name), services(name)")
    .eq("business_id", business.id)
    .gte("start_ts", startDate)
    .lt("start_ts", endDate)
    .order("start_ts", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (business as typeof business & { features?: Record<string, string> }).features || {};
  const niche = features.niche || "barber";

  // For carwash businesses, also return add-on names for display
  let addonsMap: Record<string, string> = {};
  if (niche === "carwash") {
    const { data: addons } = await supabaseAdmin
      .from("service_addons")
      .select("id, name")
      .eq("business_id", business.id);
    if (addons) {
      (addons as { id: string; name: string }[]).forEach((a) => { addonsMap[a.id] = a.name; });
    }
  }

  return NextResponse.json({ bookings: bookings || [], slug: business.slug, businessId: business.id, niche, addonsMap });
}
