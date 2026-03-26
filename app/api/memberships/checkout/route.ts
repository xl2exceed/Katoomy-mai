// POST /api/memberships/checkout
// Creates a Stripe Checkout session (subscription mode) on the connected account.

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
    const { planId, businessId, customerId, slug, customerEmail } =
      await req.json();

    if (!planId || !businessId || !customerId || !slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify plan is active
    const { data: plan } = await supabaseAdmin
      .from("membership_plans")
      .select("stripe_price_id, is_active, name")
      .eq("id", planId)
      .single();

    if (!plan?.is_active || !plan?.stripe_price_id) {
      return NextResponse.json(
        { error: "Membership plan not available" },
        { status: 400 },
      );
    }

    // Check not already subscribed
    const { data: existing } = await supabaseAdmin
      .from("member_subscriptions")
      .select("id")
      .eq("customer_id", customerId)
      .eq("business_id", businessId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already an active member" },
        { status: 400 },
      );
    }

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", businessId)
      .single();

    if (!connectAccount?.stripe_account_id) {
      return NextResponse.json(
        { error: "No Stripe account connected" },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        subscription_data: {
          application_fee_percent: 1.5,
          metadata: { planId, businessId, customerId },
        },
        customer_email: customerEmail || undefined,
        success_url: `${appUrl}/${slug}/membership-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${slug}/membership`,
        metadata: { planId, businessId, customerId },
      },
      { stripeAccount: connectAccount.stripe_account_id },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Membership checkout error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
