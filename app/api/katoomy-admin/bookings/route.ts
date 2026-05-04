// GET /api/katoomy-admin/bookings?businessId=&dateFrom=&dateTo=&paymentType=&status=
// Always returns bookings rows with consistent shape regardless of filter.

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
  const status = searchParams.get("status");

  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const BOOKING_SELECT = "id, start_ts, end_ts, status, payment_status, total_price_cents, created_at, customers(full_name, phone), services(name), booking_payment_reports(payment_method, total_amount_cents)";

  // When filtering by alternative payment method, first resolve matching booking IDs
  if (paymentType && paymentType !== "all" && paymentType !== "stripe") {
    const { data: reports } = await supabaseAdmin
      .from("booking_payment_reports")
      .select("booking_id")
      .eq("business_id", businessId)
      .eq("payment_method", paymentType);

    const bookingIds = (reports || []).map((r) => r.booking_id).filter(Boolean);
    if (bookingIds.length === 0) return NextResponse.json({ bookings: [], total: 0 });

    let query = supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT, { count: "exact" })
      .in("id", bookingIds)
      .order("start_ts", { ascending: false })
      .limit(300);

    if (dateFrom) query = query.gte("start_ts", dateFrom);
    if (dateTo) query = query.lte("start_ts", dateTo + "T23:59:59Z");
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bookings: data || [], total: count || 0 });
  }

  // Default: query bookings directly
  let query = supabaseAdmin
    .from("bookings")
    .select(BOOKING_SELECT, { count: "exact" })
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
