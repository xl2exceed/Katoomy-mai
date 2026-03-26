// file: app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { priceId, businessId, email } = await request.json();

    console.log("🚀 Creating checkout session:", {
      priceId,
      businessId,
      email,
    });

    if (!priceId || !businessId || !email) {
      console.error("❌ Missing required fields:", {
        priceId,
        businessId,
        email,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .select("stripe_customer_id, stripe_subscription_id, subscription_plan")
      .eq("id", businessId)
      .single();

    if (bizErr || !biz) {
      console.error("❌ Failed to load business:", bizErr);
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const stripeCustomerId = biz.stripe_customer_id ?? null;

    // ✅ Defense #1: prevent accidentally creating a second subscription
    // If the business already has an active subscription, upgrades should go through
    // /api/subscriptions/change instead of creating a new Checkout subscription.
    if (biz.stripe_subscription_id && biz.subscription_plan !== "free") {
      return NextResponse.json(
        {
          error:
            "Business already has an active subscription. Use /api/subscriptions/change for upgrades.",
        },
        { status: 400 },
      );
    }

    // ✅ Create checkout session (for NEW subscriptions only: Free → Paid)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],

      // ✅ Defense #2: reuse existing Stripe customer if present
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: email }),

      metadata: { businessId },
      subscription_data: { metadata: { businessId } },

      success_url: `${origin}/admin/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/admin/upgrade`,
      allow_promotion_codes: true,
    });

    console.log("✅ Checkout session created:", session.id);
    console.log("📋 Metadata:", session.metadata);

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("❌ Stripe checkout error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
