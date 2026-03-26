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
    const { bookingId, tipAmountCents, businessId, slug, customerEmail } =
      await req.json();

    if (!bookingId || !tipAmountCents || !businessId || !slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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
      process.env.NEXT_PUBLIC_APP_URL || "https://katoomy-new.vercel.app";
    const platformFeeCents = Math.round(tipAmountCents * 0.015);

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Tip",
                description: "Thank you for your generosity!",
              },
              unit_amount: tipAmountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${appUrl}/${slug}/tip-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${slug}/tip?bookingId=${bookingId}`,
        customer_email: customerEmail || undefined,
        payment_intent_data: {
          application_fee_amount: platformFeeCents,
        },
        metadata: {
          type: "tip",
          bookingId,
          businessId,
          tipAmountCents: String(tipAmountCents),
          slug,
        },
      },
      { stripeAccount: connectAccount.stripe_account_id },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Tip checkout session error:", err);
    return NextResponse.json(
      { error: "Failed to create tip checkout" },
      { status: 500 },
    );
  }
}
