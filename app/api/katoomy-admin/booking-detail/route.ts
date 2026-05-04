// GET /api/katoomy-admin/booking-detail?bookingId=

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

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const [bookingResult, paymentReportResult, altLedgerResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id, start_ts, end_ts, status, payment_status, total_price_cents, deposit_required, deposit_amount_cents, customer_notes, created_at, customers(full_name, phone, email), services(name, price_cents, duration_minutes), staff(full_name)")
      .eq("id", bookingId)
      .single(),

    supabaseAdmin
      .from("booking_payment_reports")
      .select("payment_method, total_amount_cents, service_amount_cents, tip_cents, resolution_status, resolution_reason, fee_amount_cents, fee_charged, created_at")
      .eq("booking_id", bookingId)
      .maybeSingle(),

    supabaseAdmin
      .from("alternative_payment_ledger")
      .select("payment_method, amount_cents, fee_absorbed_by, status, created_at")
      .eq("booking_id", bookingId)
      .maybeSingle(),
  ]);

  if (!bookingResult.data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({
    booking: bookingResult.data,
    paymentReport: paymentReportResult.data || null,
    altLedger: altLedgerResult.data || null,
  });
}
