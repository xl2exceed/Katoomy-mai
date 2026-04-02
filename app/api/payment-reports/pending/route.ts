// GET /api/payment-reports/pending?businessId=X
// Returns pending payment reports with full booking + customer info.
// Uses supabaseAdmin so joins work regardless of RLS (staff or admin caller).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  // Verify caller is authorized for this business (admin cookie or staff Bearer token)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let authorized = false;

  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      const { data: staff } = await supabaseAdmin
        .from("staff").select("business_id").eq("user_id", user.id).maybeSingle();
      authorized = staff?.business_id === businessId;
    }
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: biz } = await supabaseAdmin
        .from("businesses").select("id").eq("owner_user_id", user.id).maybeSingle();
      authorized = biz?.id === businessId;
    }
  }

  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use supabaseAdmin so FK joins to bookings + customers bypass RLS
  const { data } = await supabaseAdmin
    .from("booking_payment_reports")
    .select("id, booking_id, customer_id, payment_method, total_amount_cents, customer_response_at, bookings(start_ts, services(name)), customers(full_name, phone)")
    .eq("business_id", businessId)
    .eq("customer_response", "paid")
    .eq("business_response", "pending")
    .eq("resolution_status", "pending")
    .order("customer_response_at", { ascending: true });

  return NextResponse.json({ reports: data || [] });
}
