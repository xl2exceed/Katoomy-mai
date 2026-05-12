// POST /api/memberships/cancel
// Cancels the customer's Stripe subscription and marks it cancelled in DB.
// If the subscription is already gone in Stripe, still marks cancelled in DB.

import { NextRequest, NextResponse } from "next/server";
import { getStripeForAccount } from "@/lib/stripe/getStripeForAccount";
import { createClient } from "@supabase/supabase-js";
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
    const { data: sub, error: subError } = await supabaseAdmin
      .from("member_subscriptions")
      .select("id, business_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (subError) {
      console.error("member_subscriptions lookup error:", subError);
    }

    if (!sub) {
      // Not in our DB — nothing to cancel
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", sub.business_id)
      .maybeSingle();

    // Attempt Stripe cancellation — if it fails (already cancelled, not found, etc.)
    // we still mark the DB record cancelled so the customer is unblocked.
    if (connectAccount?.stripe_account_id) {
      const stripe = await getStripeForAccount(connectAccount.stripe_account_id);
      try {
        await stripe.subscriptions.cancel(
          subscriptionId,
          {},
          { stripeAccount: connectAccount.stripe_account_id },
        );
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error("Stripe cancel error (proceeding to DB update):", msg);
        // If Stripe says the subscription doesn't exist or is already cancelled,
        // that's fine — just mark it cancelled in our DB.
        const alreadyGone =
          msg.includes("No such subscription") ||
          msg.includes("already been canceled") ||
          msg.includes("already cancelled") ||
          msg.includes("does not have access to account") ||
          msg.includes("Application access may have been revoked");
        if (!alreadyGone) {
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      }
    }

    // Mark cancelled in DB
    await supabaseAdmin
      .from("member_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("Membership cancel error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
