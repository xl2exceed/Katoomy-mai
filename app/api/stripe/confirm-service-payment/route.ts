// file: app/api/stripe/confirm-service-payment/route.ts
// Confirms a pay-with-tip session: marks booking paid, records tip, awards loyalty points.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Award loyalty + referral points after a payment is confirmed.
// Safe to call multiple times — uses idempotency checks.
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

export async function POST(req: NextRequest) {
  try {
    const { sessionId, slug } = await req.json();

    if (!sessionId || !slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", business.id)
      .single();

    if (!connectAccount?.stripe_account_id) {
      return NextResponse.json(
        { error: "No connect account found" },
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: connectAccount.stripe_account_id },
    );

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    }

    const { bookingId, businessId, customerId, tipCents, staffId: metaStaffId, customerName: metaCustomerName } = session.metadata!;

    // Idempotency: skip if booking already marked paid
    const { data: existingBooking } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, total_price_cents, customer_id")
      .eq("id", bookingId)
      .single();

    if (["paid", "cash_paid", "custom_paid"].includes(existingBooking?.payment_status ?? "")) {
      return NextResponse.json({ success: true });
    }

    const safeTipCents = Number(tipCents) || 0;
    const isCustomBooking = existingBooking?.status === "custom";

    // Mark booking as paid (custom_paid for custom-status bookings, paid otherwise)
    await supabaseAdmin
      .from("bookings")
      .update({ payment_status: isCustomBooking ? "custom_paid" : "paid" })
      .eq("id", bookingId);

    // For custom-status bookings, also record in alternative_payment_ledger
    if (isCustomBooking) {
      const ts = new Date();
      const billingMonth = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
      const serviceCentsForLedger = (session.amount_total ?? 0) - safeTipCents;
      // Look up the booking's service name and customer name if not in metadata
      const { data: bookingForLedger } = await supabaseAdmin
        .from("bookings")
        .select("services(name), customers(full_name), staff_id")
        .eq("id", bookingId)
        .single();
      const serviceNameForLedger =
        (bookingForLedger?.services as unknown as { name: string } | null)?.name ||
        "Custom payment (credit card)";
      const customerNameForLedger =
        metaCustomerName ||
        (bookingForLedger?.customers as unknown as { full_name: string } | null)?.full_name ||
        null;
      const staffIdForLedger =
        metaStaffId ||
        (bookingForLedger?.staff_id as string | null) ||
        null;
      // Idempotency: skip if ledger entry already exists for this booking
      const { data: existingLedger } = await supabaseAdmin
        .from("alternative_payment_ledger")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!existingLedger) {
        await supabaseAdmin.from("alternative_payment_ledger").insert({
          business_id: businessId,
          booking_id: bookingId,
          customer_name: customerNameForLedger,
          service_name: serviceNameForLedger,
          service_amount_cents: serviceCentsForLedger,
          tip_cents: safeTipCents,
          platform_fee_cents: 0,
          payment_method: "card",
          fee_absorbed_by: "customer",
          billing_month: billingMonth,
          billing_status: "stripe_collected",
          appointment_ts: ts.toISOString(),
          marked_paid_by: staffIdForLedger,
          notes: "Stripe card payment — fee collected automatically",
        });
      }
    }

    // Record payment (service portion only; tip goes in tips table)
    const serviceCents = (session.amount_total ?? 0) - safeTipCents;
    await supabaseAdmin.from("payments").upsert(
      {
        business_id: businessId,
        booking_id: bookingId,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_cents: serviceCents,
        status: "succeeded",
      },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    );

    // Record tip if one was included
    if (safeTipCents > 0) {
      // Idempotency: check if tip already recorded for this session
      const { data: existingTip } = await supabaseAdmin
        .from("tips")
        .select("id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (!existingTip) {
        await supabaseAdmin.from("tips").insert({
          business_id: businessId,
          booking_id: bookingId,
          customer_id: customerId,
          amount_cents: safeTipCents,
          stripe_session_id: sessionId,
          stripe_tip_intent_id: session.payment_intent as string,
          status: "paid",
        });
      }
    }

    // Award loyalty points now that payment is confirmed
    await awardLoyaltyOnPayment(supabaseAdmin, businessId, customerId, bookingId);

    // Return referral code so pay-success page can show referral prompt
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("referral_code")
      .eq("id", customerId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      referralCode: customer?.referral_code ?? null,
    });
  } catch (err) {
    console.error("Confirm service payment error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
