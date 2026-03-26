// POST /api/memberships/confirm
// Called after Stripe Checkout redirect. Retrieves session, records subscription in DB.

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
        { error: "No Stripe account found" },
        { status: 400 },
      );
    }

    const stripeAccount = connectAccount.stripe_account_id;

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount },
    );

    if (!session.subscription) {
      return NextResponse.json(
        { error: "No subscription in session" },
        { status: 400 },
      );
    }

    const { planId, businessId, customerId } = session.metadata!;

    // Idempotency: skip if already recorded
    const { data: existing } = await supabaseAdmin
      .from("member_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", session.subscription as string)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true });
    }

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
      {},
      { stripeAccount },
    );

    await supabaseAdmin.from("member_subscriptions").insert({
      business_id: businessId,
      customer_id: customerId,
      plan_id: planId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status === "active" ? "active" : "past_due",
      current_period_end: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Membership confirm error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
