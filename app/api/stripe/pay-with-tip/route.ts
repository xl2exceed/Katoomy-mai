// file: app/api/stripe/pay-with-tip/route.ts
// Creates a Stripe checkout for service payment + optional tip (for unpaid bookings)

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { bookingId, serviceCents, tipCents, businessId, slug, customerEmail } =
      await req.json();

    if (!bookingId || !businessId || !slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get booking details
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, total_price_cents, payment_status, customer_id")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (["paid", "cash_paid", "custom_paid"].includes(booking.payment_status)) {
      return NextResponse.json(
        { error: "Booking already paid" },
        { status: 400 },
      );
    }

    // Get connect account
    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("business_id", businessId)
      .eq("charges_enabled", true)
      .single();

    if (!connectAccount?.stripe_account_id) {
      return NextResponse.json(
        { error: "Business is not set up to accept payments" },
        { status: 400 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

    const safeTipCents = tipCents && tipCents > 0 ? tipCents : 0;
    // Use client-computed serviceCents (handles deposit remaining balance correctly)
    const safeServiceCents = serviceCents && serviceCents > 0 ? serviceCents : booking.total_price_cents;
    const totalCents = safeServiceCents + safeTipCents;
    const platformFeeCents = Math.round(totalCents * 0.015);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Service Payment" },
          unit_amount: safeServiceCents,
        },
        quantity: 1,
      },
    ];

    if (safeTipCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Tip" },
          unit_amount: safeTipCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${appUrl}/${slug}/pay-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${slug}/pay?bookingId=${bookingId}`,
        customer_email: customerEmail || undefined,
        payment_intent_data: { application_fee_amount: platformFeeCents },
        metadata: {
          bookingId,
          businessId,
          customerId: booking.customer_id,
          tipCents: String(safeTipCents),
        },
      },
      { stripeAccount: connectAccount.stripe_account_id },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Pay-with-tip checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
