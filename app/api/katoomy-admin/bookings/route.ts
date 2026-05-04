// GET /api/katoomy-admin/bookings?businessId=&dateFrom=&dateTo=&paymentType=&status=

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_TOKEN = process.env.KATOOMY_ADMIN_TOKEN || "katoomy-internal-2026";
function authorize(req: NextRequest) {
  return req.headers.get("x-katoomy-token") === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const businessId = searchParams.get("businessId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const paymentType = searchParams.get("paymentType"); // cash_app | zelle | cash | stripe | all
  const status = searchParams.get("status"); // completed | no_show | etc

  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  if (paymentType && paymentType !== "all" && paymentType !== "stripe") {
    // Filter by alternative payment method via booking_payment_reports join
    let query = supabaseAdmin
      .from("booking_payment_reports")
      .select("booking_id, payment_method, total_amount_cents, resolution_status, bookings!inner(id, start_ts, end_ts, status, payment_status, total_price_cents, customers(full_name, phone), services(name))")
      .eq("business_id", businessId)
      .eq("payment_method", paymentType);

    if (dateFrom) query = query.gte("bookings.start_ts", dateFrom);
    if (dateTo) query = query.lte("bookings.start_ts", dateTo + "T23:59:59Z");

    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bookings: data || [] });
  }

  // Default: query bookings directly
  let query = supabaseAdmin
    .from("bookings")
    .select("id, start_ts, end_ts, status, payment_status, total_price_cents, created_at, customers(full_name, phone), services(name), booking_payment_reports(payment_method, total_amount_cents)", { count: "exact" })
    .eq("business_id", businessId)
    .order("start_ts", { ascending: false })
    .limit(300);

  if (dateFrom) query = query.gte("start_ts", dateFrom);
  if (dateTo) query = query.lte("start_ts", dateTo + "T23:59:59Z");
  if (status) query = query.eq("status", status);
  if (paymentType === "stripe") query = query.eq("payment_status", "succeeded");

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data || [], total: count || 0 });
}
