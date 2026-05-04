// GET /api/katoomy-admin/customer-detail?customerId=

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

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });

  const [customerResult, bookingsResult] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, email, created_at, last_visit_at, sms_consent, referral_code")
      .eq("id", customerId)
      .single(),

    supabaseAdmin
      .from("bookings")
      .select("id, start_ts, end_ts, status, payment_status, total_price_cents, customer_notes, services(name, price_cents), staff(full_name), booking_payment_reports(payment_method, total_amount_cents, resolution_status)")
      .eq("customer_id", customerId)
      .order("start_ts", { ascending: false }),
  ]);

  if (!customerResult.data) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  return NextResponse.json({
    customer: customerResult.data,
    bookings: bookingsResult.data || [],
  });
}
