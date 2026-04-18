// POST /api/payment-reports/customer-response
// Called when customer taps "I've Paid". Creates or updates booking_payment_report.
// For source=qr (business-initiated take-payment), auto-confirms immediately.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function awardLoyaltyOnPayment(businessId: string, customerId: string, bookingId: string) {
  const { data: loyalty } = await supabaseAdmin
    .from("loyalty_settings")
    .select("enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points")
    .eq("business_id", businessId)
    .single();

  if (loyalty?.enabled && loyalty.earn_on_completion) {
    const { data: existing } = await supabaseAdmin
      .from("loyalty_ledger").select("id")
      .eq("related_booking_id", bookingId).eq("event_type", "completion").maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("loyalty_ledger").insert({
        business_id: businessId, customer_id: customerId,
        event_type: "completion", points_delta: loyalty.points_per_event, related_booking_id: bookingId,
      });
    }
  }

  if (loyalty?.referral_enabled !== false) {
    const { data: referral } = await supabaseAdmin
      .from("referrals").select("id, referrer_customer_id")
      .eq("business_id", businessId).eq("referred_customer_id", customerId).eq("status", "pending").maybeSingle();
    if (referral) {
      const referrerPoints = loyalty?.referrer_reward_points ?? 15;
      const { data: existingRef } = await supabaseAdmin
        .from("loyalty_ledger").select("id")
        .eq("related_booking_id", bookingId).eq("event_type", "referral")
        .eq("customer_id", referral.referrer_customer_id).maybeSingle();
      if (!existingRef) {
        await supabaseAdmin.from("loyalty_ledger").insert({
          business_id: businessId, customer_id: referral.referrer_customer_id,
          points_delta: referrerPoints, event_type: "referral", related_booking_id: bookingId,
        });
      }
      await supabaseAdmin.from("referrals").update({
        status: "completed", reward_points_awarded: referrerPoints,
        first_completed_booking_id: bookingId, completed_at: new Date().toISOString(),
      }).eq("id", referral.id);
    }
  }
}

export async function POST(req: NextRequest) {
  const { bookingId, paymentMethod, serviceCents, tipCents, feeMode, source } = await req.json();
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

  // For source=qr (take-payment QR flow), the $1 is already in serviceCents — don't add it again
  const isQrFlow = source === "qr";
  const platformFeeCents = (!isQrFlow && feeMode === "pass_to_customer") ? 100 : 0;
  const service = serviceCents ?? booking.total_price_cents;
  const tip = tipCents ?? 0;
  const total = service + tip + platformFeeCents;

  const autoResolveAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Check if a previous report exists (e.g. business clicked Unpaid after first claim)
  const { data: existing } = await supabaseAdmin
    .from("booking_payment_reports")
    .select("id, resolution_status")
    .eq("booking_id", bookingId)
    .maybeSingle();

  // If the report was disputed/resolved, reset it to pending so the business
  // gets a new notification banner when the customer tries to pay again.
  const resetFields = existing && existing.resolution_status !== "pending"
    ? { business_response: "pending", business_response_at: null, resolution_status: "pending", resolution_reason: null, resolved_at: null }
    : {};

  // For take-payment QR flow, auto-set business_response=paid so it resolves immediately
  const qrAutoConfirmFields = isQrFlow
    ? { business_response: "paid", business_response_at: now }
    : {};

  const { data: report, error } = await supabaseAdmin
    .from("booking_payment_reports")
    .upsert({
      booking_id: bookingId,
      business_id: booking.business_id,
      customer_id: booking.customer_id,
      payment_method: paymentMethod,
      customer_response: "paid",
      customer_response_at: now,
      service_amount_cents: service,
      tip_cents: tip,
      total_amount_cents: total,
      auto_resolve_at: autoResolveAt,
      ...resetFields,
      ...qrAutoConfirmFields,
    }, { onConflict: "booking_id", ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error("[customer-response] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Run resolver — for qr flow this will immediately confirm the payment
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

  // Mark the booking as paid and complete when payment is confirmed
  if (resolution.fee_should_charge) {
    // Only update if not already paid (idempotent)
    const { data: currentBooking } = await supabaseAdmin
      .from("bookings")
      .select("payment_status, status")
      .eq("id", report.booking_id)
      .single();

    if (currentBooking && !["paid", "cash_paid", "custom_paid"].includes(currentBooking.payment_status)) {
      await supabaseAdmin
        .from("bookings")
        .update({ payment_status: "cash_paid", status: "completed" })
        .eq("id", report.booking_id);
    }

    // Award loyalty points
    if (report.business_id && report.customer_id) {
      await awardLoyaltyOnPayment(report.business_id, report.customer_id, report.booking_id);
    }
  }

  // If fee should charge, record in alternative_payment_ledger for monthly billing
  if (resolution.fee_should_charge) {
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [existing, { data: cashSettings }] = await Promise.all([
      supabaseAdmin.from("alternative_payment_ledger").select("id").eq("booking_id", report.booking_id).maybeSingle(),
      supabaseAdmin.from("cashapp_settings").select("fee_mode").eq("business_id", report.business_id).maybeSingle(),
    ]);

    if (!existing.data) {
      const feeAbsorbedBy = cashSettings?.fee_mode === "business_absorbs" ? "business" : "customer";
      const platformFeeCents = cashSettings?.fee_mode === "business_absorbs" ? 0 : 100;
      await supabaseAdmin.from("alternative_payment_ledger").insert({
        business_id: report.business_id,
        booking_id: report.booking_id,
        customer_name: null,
        service_name: null,
        service_amount_cents: report.service_amount_cents,
        tip_cents: report.tip_cents,
        platform_fee_cents: platformFeeCents,
        payment_method: report.payment_method === "cash_app" ? "cashapp" : report.payment_method === "zelle" ? "other" : "cash",
        fee_absorbed_by: feeAbsorbedBy,
        billing_month: billingMonth,
        billing_status: "pending",
        notes: `Auto-resolved: ${resolution.resolution_reason}`,
      });
    }
  }
}
