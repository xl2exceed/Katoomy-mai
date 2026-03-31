import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, slug")
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
    .select("id, customer_id, business_id, start_ts, status, payment_status, total_price_cents, deposit_amount_cents, customer_notes, customers(full_name, phone), staff(full_name), services(name)")
    .eq("business_id", business.id)
    .gte("start_ts", startDate)
    .lt("start_ts", endDate)
    .order("start_ts", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: bookings || [], slug: business.slug, businessId: business.id });
}
