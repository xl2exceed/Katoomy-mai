import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function awardLoyaltyOnPayment(
  db: SupabaseClient,
  businessId: string,
  customerId: string,
  bookingId: string,
) {
  const { data: loyalty } = await db
    .from("loyalty_settings")
    .select("enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points")
    .eq("business_id", businessId)
    .single();

  // Completion points
  if (loyalty?.enabled && loyalty.earn_on_completion) {
    const { data: existing } = await db
      .from("loyalty_ledger")
      .select("id")
      .eq("related_booking_id", bookingId)
      .eq("event_type", "completion")
      .maybeSingle();

    if (!existing) {
      await db.from("loyalty_ledger").insert({
        business_id: businessId,
        customer_id: customerId,
        event_type: "completion",
        points_delta: loyalty.points_per_event,
        related_booking_id: bookingId,
      });
    }
  }

  // Referral points
  if (loyalty?.referral_enabled !== false) {
    const { data: referral } = await db
      .from("referrals")
      .select("id, referrer_customer_id")
      .eq("business_id", businessId)
      .eq("referred_customer_id", customerId)
      .eq("status", "pending")
      .maybeSingle();

    if (referral) {
      const referrerPoints = loyalty?.referrer_reward_points ?? 15;
      const { data: existingRef } = await db
        .from("loyalty_ledger")
        .select("id")
        .eq("related_booking_id", bookingId)
        .eq("event_type", "referral")
        .eq("customer_id", referral.referrer_customer_id)
        .maybeSingle();

      if (!existingRef) {
        await db.from("loyalty_ledger").insert({
          business_id: businessId,
          customer_id: referral.referrer_customer_id,
          points_delta: referrerPoints,
          event_type: "referral",
          related_booking_id: bookingId,
        });
      }

      await db.from("referrals").update({
        status: "completed",
        reward_points_awarded: referrerPoints,
        first_completed_booking_id: bookingId,
        completed_at: new Date().toISOString(),
      }).eq("id", referral.id);
    }
  }
}

// Public endpoint -- no auth required (customer claiming they sent Cash App payment)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { bookingId, totalCents } = body;

  if (!bookingId || !totalCents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Look up the booking
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, business_id, customer_id, total_price_cents, payment_status, services(name)")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    console.error("[cashapp/customer-claim] Booking lookup failed:", bookingError?.message);
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Idempotency: already processed
  if (booking.payment_status === "cash_paid" || booking.payment_status === "paid") {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("referral_code, full_name, phone")
      .eq("id", booking.customer_id)
      .maybeSingle();
    return NextResponse.json({ success: true, referralCode: customer?.referral_code ?? null });
  }

  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const servicesArr = booking.services as unknown as { name: string }[] | null;
  const serviceName = Array.isArray(servicesArr) ? servicesArr[0]?.name : null;
  const serviceAmountCents = booking.total_price_cents ?? 0;
  const tipCents = totalCents - serviceAmountCents > 0 ? totalCents - serviceAmountCents : 0;

  // Fetch customer info
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("full_name, phone, referral_code")
    .eq("id", booking.customer_id)
    .maybeSingle();

  // Insert ledger entry
  const { error: ledgerError } = await supabaseAdmin
    .from("alternative_payment_ledger")
    .insert({
      business_id: booking.business_id,
      booking_id: bookingId,
      customer_name: customer?.full_name ?? null,
      customer_phone: customer?.phone ?? null,
      service_name: serviceName ?? null,
      service_amount_cents: serviceAmountCents,
      tip_cents: tipCents,
      platform_fee_cents: 100,
      payment_method: "cashapp",
      fee_absorbed_by: "customer",
      billing_month: billingMonth,
      billing_status: "pending",
      notes: "Customer self-reported payment via Cash App",
    });

  if (ledgerError) {
    console.error("[cashapp/customer-claim] Ledger insert failed:", ledgerError.message);
  }

  // Mark booking as cash_paid so it appears in revenue
  await supabaseAdmin
    .from("bookings")
    .update({ payment_status: "cash_paid" })
    .eq("id", bookingId);

  // Award loyalty points
  await awardLoyaltyOnPayment(supabaseAdmin, booking.business_id, booking.customer_id, bookingId);

  return NextResponse.json({
    success: true,
    referralCode: customer?.referral_code ?? null,
  });
}
