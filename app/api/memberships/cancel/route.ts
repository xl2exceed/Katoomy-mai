// POST /api/memberships/cancel
// Cancels the customer's Stripe subscription immediately and updates DB.

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
    const { subscriptionId, customerId } = await req.json();

    if (!subscriptionId || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Look up subscription to get business_id
    const { data: sub } = await supabaseAdmin
      .from("member_subscriptions")
      .select("business_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("customer_id", customerId)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", sub.business_id)
      .single();

    if (!connectAccount?.stripe_account_id) {
      return NextResponse.json(
        { error: "No Stripe account found" },
        { status: 400 },
      );
    }

    // Cancel in Stripe
    await stripe.subscriptions.cancel(
      subscriptionId,
      {},
      { stripeAccount: connectAccount.stripe_account_id },
    );

    // Mark cancelled in DB
    await supabaseAdmin
      .from("member_subscriptions")
      .update({ status: "cancelled" })
      .eq("stripe_subscription_id", subscriptionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Membership cancel error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
