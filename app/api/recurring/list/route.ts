// GET /api/recurring/list — admin: list recurring schedules for the authenticated business
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const statusFilter = req.nextUrl.searchParams.get("status"); // 'active' | 'paused' | 'cancelled' | null (all)

  let query = supabaseAdmin
    .from("recurring_schedules")
    .select(`
      id, frequency, preferred_time, day_of_week, property_size,
      price_cents, status, next_booking_date, last_booking_created_at,
      notes, created_at,
      customers(id, full_name, phone),
      services(id, name)
    `)
    .eq("business_id", biz.id)
    .order("next_booking_date", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
