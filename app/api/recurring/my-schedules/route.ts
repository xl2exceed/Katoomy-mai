// GET /api/recurring/my-schedules?customerId=...&businessId=...
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!customerId || !businessId)
    return NextResponse.json({ error: "customerId and businessId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("recurring_schedules")
    .select("id, frequency, preferred_time, day_of_week, price_cents, status, next_booking_date, services(id, name)")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
