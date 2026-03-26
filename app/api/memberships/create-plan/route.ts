// POST /api/memberships/create-plan
// Business creates (or updates) their membership plan.
// Creates a Stripe Product + recurring Price on their connected account.

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
    const { businessId, name, description, priceCents, discountPercent } =
      await req.json();

    if (!businessId || !name || !priceCents || discountPercent === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const stripeAccount = connectAccount.stripe_account_id;

    // Check if plan already exists for this business
    const { data: existingPlan } = await supabaseAdmin
      .from("membership_plans")
      .select("id, stripe_product_id, stripe_price_id")
      .eq("business_id", businessId)
      .single();

    let stripeProductId: string;
    let stripePriceId: string;

    if (existingPlan?.stripe_product_id) {
      // Update the existing product name
      await stripe.products.update(
        existingPlan.stripe_product_id,
        { name, description: description || undefined },
        { stripeAccount },
      );
      stripeProductId = existingPlan.stripe_product_id;

      // Archive old price if price changed, create new one
      if (existingPlan.stripe_price_id) {
        await stripe.prices.update(
          existingPlan.stripe_price_id,
          { active: false },
          { stripeAccount },
        );
      }
    } else {
      // Create new Stripe product
      const product = await stripe.products.create(
        { name, description: description || undefined },
        { stripeAccount },
      );
      stripeProductId = product.id;
    }

    // Create new recurring price
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: priceCents,
        currency: "usd",
        recurring: { interval: "month" },
      },
      { stripeAccount },
    );
    stripePriceId = price.id;

    // Upsert membership plan (one plan per business)
    const { data: plan, error } = await supabaseAdmin
      .from("membership_plans")
      .upsert(
        {
          business_id: businessId,
          name,
          description: description || null,
          price_cents: priceCents,
          discount_percent: discountPercent,
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
          is_active: true,
        },
        { onConflict: "business_id" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ planId: plan.id });
  } catch (err) {
    console.error("Create membership plan error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
