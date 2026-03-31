// POST /api/stripe/refund
// Issues a full or partial refund on a direct charge to a connected Stripe account.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, amountCents, reason } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  // Verify this booking belongs to the authenticated business owner
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, business_id, payment_status, total_price_cents")
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!["paid"].includes(booking.payment_status)) {
    return NextResponse.json({ error: "Booking is not eligible for refund" }, { status: 400 });
  }

  // Get the payment record with Stripe payment intent ID
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, stripe_payment_intent_id, amount_cents")
    .eq("booking_id", bookingId)
    .eq("status", "succeeded")
    .single();

  if (!payment?.stripe_payment_intent_id) {
    return NextResponse.json({ error: "No Stripe payment found for this booking" }, { status: 404 });
  }

  // Check for existing refunds to avoid over-refunding
  const { data: existingRefunds } = await supabaseAdmin
    .from("refunds")
    .select("amount_cents")
    .eq("booking_id", bookingId)
    .eq("status", "succeeded");

  const alreadyRefundedCents = (existingRefunds || []).reduce((s, r) => s + r.amount_cents, 0);
  const maxRefundable = payment.amount_cents - alreadyRefundedCents;

  if (maxRefundable <= 0) {
    return NextResponse.json({ error: "This booking has already been fully refunded" }, { status: 400 });
  }

  const refundAmount = amountCents ? Math.min(amountCents, maxRefundable) : maxRefundable;

  // Get the connected Stripe account for this business
  const { data: connectAccount } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("business_id", business.id)
    .single();

  if (!connectAccount?.stripe_account_id) {
    return NextResponse.json({ error: "No Stripe account connected" }, { status: 400 });
  }

  // Issue the refund on the connected account
  let stripeRefund: Stripe.Refund;
  try {
    stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundAmount,
        reason: (reason as Stripe.RefundCreateParams.Reason) || undefined,
      },
      { stripeAccount: connectAccount.stripe_account_id }
    );
  } catch (err) {
    const stripeErr = err as Stripe.StripeRawError;
    return NextResponse.json(
      { error: stripeErr.message || "Stripe refund failed" },
      { status: 400 }
    );
  }

  // Log the refund
  await supabaseAdmin.from("refunds").insert({
    business_id: business.id,
    booking_id: bookingId,
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_refund_id: stripeRefund.id,
    amount_cents: refundAmount,
    reason: reason || null,
    status: stripeRefund.status,
    refunded_by_user_id: user.id,
  });

  // If fully refunded, update booking payment_status
  if (refundAmount >= maxRefundable) {
    await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "refunded" })
      .eq("id", bookingId);

    await supabaseAdmin
      .from("payments")
      .update({ status: "refunded" })
      .eq("booking_id", bookingId);
  }

  return NextResponse.json({
    success: true,
    refundId: stripeRefund.id,
    amountCents: refundAmount,
    status: stripeRefund.status,
    alreadyRefundedCents,
    maxRefundable,
  });
}
