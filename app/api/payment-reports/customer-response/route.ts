// POST /api/payment-reports/customer-response
// Called when customer taps "I've Paid". Creates or updates booking_payment_report.
// Public-ish: customer auth via phone OTP cookie (supabase client).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { bookingId, paymentMethod, serviceCents, tipCents, feeMode } = await req.json();
  if (!bookingId || !paymentMethod) {
    return NextResponse.json({ error: "Missing bookingId or paymentMethod" }, { status: 400 });
  }

  // Fetch booking to verify ownership and get business/customer ids
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, business_id, customer_id, total_price_cents")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const platformFeeCents = feeMode === "pass_to_customer" ? 100 : 0;
  const service = serviceCents ?? booking.total_price_cents;
  const tip = tipCents ?? 0;
  const total = service + tip + platformFeeCents;

  const autoResolveAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Upsert — idempotent if customer taps again
  const { data: report, error } = await supabaseAdmin
    .from("booking_payment_reports")
    .upsert({
      booking_id: bookingId,
      business_id: booking.business_id,
      customer_id: booking.customer_id,
      payment_method: paymentMethod,
      customer_response: "paid",
      customer_response_at: new Date().toISOString(),
      service_amount_cents: service,
      tip_cents: tip,
      total_amount_cents: total,
      auto_resolve_at: autoResolveAt,
    }, { onConflict: "booking_id", ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error("[customer-response] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Run resolver in case business already responded
  await resolveReport(report.id);

  return NextResponse.json({ success: true, reportId: report.id });
}

async function resolveReport(reportId: string) {
  const { data: report } = await supabaseAdmin
    .from("booking_payment_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (!report || report.resolution_status !== "pending") return;

  const now = new Date();
  const timedOut = now >= new Date(report.auto_resolve_at);
  const c = report.customer_response;
  const b = report.business_response;

  let resolution: { resolution_status: string; resolution_reason: string; fee_should_charge: boolean } | null = null;

  if ((c === "paid" || c === "unpaid") && b === "paid") {
    resolution = { resolution_status: "confirmed_paid", resolution_reason: "business_paid_only", fee_should_charge: true };
  } else if (c === "paid" && b === "paid") {
    resolution = { resolution_status: "confirmed_paid", resolution_reason: "both_paid", fee_should_charge: true };
  } else if (c === "paid" && b === "unpaid") {
    resolution = { resolution_status: "disputed_unpaid", resolution_reason: "customer_paid_business_unpaid", fee_should_charge: false };
  } else if (timedOut && c === "paid" && b === "pending") {
    resolution = { resolution_status: "auto_confirmed", resolution_reason: "customer_paid_business_timeout", fee_should_charge: true };
  } else if (timedOut && c === "pending" && b === "pending") {
    resolution = { resolution_status: "auto_confirmed", resolution_reason: "no_response_timeout", fee_should_charge: true };
  }

  if (!resolution) return;

  await supabaseAdmin.from("booking_payment_reports").update({
    ...resolution,
    resolved_at: now.toISOString(),
  }).eq("id", reportId);

  // If fee should charge, record in alternative_payment_ledger for monthly billing
  if (resolution.fee_should_charge) {
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existing = await supabaseAdmin
      .from("alternative_payment_ledger")
      .select("id")
      .eq("booking_id", report.booking_id)
      .maybeSingle();

    if (!existing.data) {
      await supabaseAdmin.from("alternative_payment_ledger").insert({
        business_id: report.business_id,
        booking_id: report.booking_id,
        service_amount_cents: report.service_amount_cents,
        tip_cents: report.tip_cents,
        platform_fee_cents: report.fee_amount_cents,
        payment_method: report.payment_method,
        fee_absorbed_by: report.fee_amount_cents > 0 ? "customer" : "business",
        billing_month: billingMonth,
        billing_status: "pending",
        notes: `Auto-resolved: ${resolution.resolution_reason}`,
      });
    }
  }
}
