import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Plan = "free" | "pro" | "premium";
type Interval = "monthly" | "annual" | null;

const PRO_MONTHLY = process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
const PRO_ANNUAL = process.env.STRIPE_PRO_ANNUAL_PRICE_ID!;
const PREMIUM_MONTHLY = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!;
const PREMIUM_ANNUAL = process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID!;

function planFromPriceId(priceId: string | null): Plan {
  if (!priceId) return "free";

  const pro = [PRO_MONTHLY, PRO_ANNUAL];
  const premium = [PREMIUM_MONTHLY, PREMIUM_ANNUAL];

  if (premium.includes(priceId)) return "premium";
  if (pro.includes(priceId)) return "pro";

  console.warn("Price ID not recognized, defaulting to free:", priceId);
  return "free";
}

function intervalFromPriceId(priceId: string | null): Interval {
  if (!priceId) return null;
  if (priceId === PRO_ANNUAL || priceId === PREMIUM_ANNUAL) return "annual";
  if (priceId === PRO_MONTHLY || priceId === PREMIUM_MONTHLY) return "monthly";
  return null;
}

// Exact month/year math using UTC (avoids DST/timezone issues)
function addMonthsUTC(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}
function addYearsUTC(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

function getSubscriptionPriceId(sub: Stripe.Subscription): string | null {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  return priceId ?? null;
}

function computePeriodEndIsoFromSubscription(
  sub: Stripe.Subscription,
  priceId: string | null,
): string | null {
  // Some Stripe typings omit current_period_end even when present
  const anySub = sub as unknown as { current_period_end?: number };

  // Prefer Stripe’s exact value if available
  if (typeof anySub.current_period_end === "number") {
    return new Date(anySub.current_period_end * 1000).toISOString();
  }

  // Trial end is exact if present
  if (typeof sub.trial_end === "number") {
    return new Date(sub.trial_end * 1000).toISOString();
  }

  // Compute from billing_cycle_anchor using calendar math (exact month lengths)
  if (typeof sub.billing_cycle_anchor === "number") {
    const anchor = new Date(sub.billing_cycle_anchor * 1000);
    const interval = intervalFromPriceId(priceId);

    const end =
      interval === "annual" ? addYearsUTC(anchor, 1) : addMonthsUTC(anchor, 1); // default to monthly if unknown

    return end.toISOString();
  }

  return null;
}

async function getBusinessIdByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function updateBusinessSubscription(params: {
  businessId: string;
  plan: Plan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEndIso: string | null;
}) {
  const {
    businessId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
    currentPeriodEndIso,
  } = params;

  console.log("=== UPDATING BUSINESS SUBSCRIPTION ===");
  console.log("Business ID:", businessId);
  console.log("Update data:", {
    subscription_plan: plan,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: subscriptionStatus,
    subscription_current_period_end: currentPeriodEndIso,
  });

  const { error } = await supabaseAdmin
    .from("businesses")
    .update({
      subscription_plan: plan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: subscriptionStatus,
      subscription_current_period_end: currentPeriodEndIso,
    })
    .eq("id", businessId);

  if (error) throw error;

  console.log("==== DATABASE UPDATE SUCCESS ====");
}

function computeConnectStatus(
  acct: Stripe.Account,
): "pending" | "restricted" | "active" {
  if (acct.charges_enabled && acct.payouts_enabled) return "active";
  if (acct.details_submitted) return "restricted";
  return "pending";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid webhook signature";
    console.error("Webhook signature error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("Received webhook event:", event.type);

  try {
    /**
     * 1) CHECKOUT (Free -> Paid)
     *    This fires when you create the initial subscription via Stripe Checkout.
     */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const businessId = session.metadata?.businessId ?? null;
      if (!businessId) {
        throw new Error("Missing metadata.businessId on Checkout Session");
      }

      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null);

      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);

      console.log("=== CHECKOUT COMPLETED ===");
      console.log("Session ID:", session.id);
      console.log("Business ID:", businessId);
      console.log("Customer:", stripeCustomerId);
      console.log("Subscription:", stripeSubscriptionId);

      // Retrieve session with expanded line items so we can see the price ID
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      });

      const priceObj = expanded.line_items?.data?.[0]?.price;
      const priceId =
        priceObj && typeof priceObj !== "string"
          ? (priceObj.id as string)
          : null;

      const plan = planFromPriceId(priceId);

      // Retrieve subscription (optional but lets you get status/anchor/trial)
      let subscriptionStatus: string | null = null;
      let currentPeriodEndIso: string | null = null;

      if (stripeSubscriptionId) {
        const subRes =
          await stripe.subscriptions.retrieve(stripeSubscriptionId);

        // Some SDKs wrap the subscription in { data: ... }
        const subObj: unknown =
          subRes && typeof subRes === "object" && "data" in subRes
            ? (subRes as { data: unknown }).data
            : subRes;

        const sub = subObj as Stripe.Subscription;
        subscriptionStatus = sub.status ?? null;

        const subPriceId = getSubscriptionPriceId(sub) ?? priceId;
        currentPeriodEndIso = computePeriodEndIsoFromSubscription(
          sub,
          subPriceId,
        );

        console.log("Checkout sub status:", subscriptionStatus);
        console.log("Checkout period end:", currentPeriodEndIso);
      }

      await updateBusinessSubscription({
        businessId,
        plan,
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: subscriptionStatus ?? "active",
        currentPeriodEndIso,
      });
    }

    /**
     * 2) PORTAL + GENERAL SUBSCRIPTION CHANGES
     *    These fire when customers upgrade/downgrade/cancel in the Stripe Portal.
     *    They do NOT go through checkout.session.completed.
     */
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const stripeSubscriptionId = sub.id;
      const stripeCustomerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const priceId = getSubscriptionPriceId(sub);
      const plan = planFromPriceId(priceId);

      const subscriptionStatus = sub.status ?? null;
      const currentPeriodEndIso = computePeriodEndIsoFromSubscription(
        sub,
        priceId,
      );

      const businessId =
        await getBusinessIdByStripeCustomerId(stripeCustomerId);
      if (!businessId) {
        console.warn(
          "No business found for stripe_customer_id (subscription updated):",
          stripeCustomerId,
        );
      } else {
        console.log("=== SUBSCRIPTION SYNC (PORTAL/UPDATED) ===");
        console.log("Business ID:", businessId);
        console.log("Customer:", stripeCustomerId);
        console.log("Subscription:", stripeSubscriptionId);
        console.log("Price ID:", priceId);
        console.log("Plan:", plan);
        console.log("Status:", subscriptionStatus);
        console.log("Period end:", currentPeriodEndIso);

        await updateBusinessSubscription({
          businessId,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          subscriptionStatus,
          currentPeriodEndIso,
        });
      }
    }

    /**
     * 3) CANCEL (PORTAL or otherwise)
     */
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const stripeCustomerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const businessId =
        await getBusinessIdByStripeCustomerId(stripeCustomerId);
      if (!businessId) {
        console.warn(
          "No business found for stripe_customer_id (subscription deleted):",
          stripeCustomerId,
        );
      } else {
        console.log("=== SUBSCRIPTION CANCELED ===");
        console.log("Business ID:", businessId);
        console.log("Customer:", stripeCustomerId);
        console.log("Subscription:", sub.id);

        // When canceled, revert to free and clear subscription fields
        await updateBusinessSubscription({
          businessId,
          plan: "free",
          stripeCustomerId,
          stripeSubscriptionId: null,
          subscriptionStatus: "canceled",
          currentPeriodEndIso: null,
        });
      }
    }

    /**
     * 4) PAYMENT FAILED (recommended)
     *    Keeps subscription_status accurate when payments fail.
     */
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      const stripeCustomerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer?.id ?? null);

      if (stripeCustomerId) {
        const businessId =
          await getBusinessIdByStripeCustomerId(stripeCustomerId);
        if (!businessId) {
          console.warn(
            "No business found for stripe_customer_id (payment_failed):",
            stripeCustomerId,
          );
        } else {
          console.log("=== INVOICE PAYMENT FAILED ===");
          console.log("Business ID:", businessId);
          console.log("Customer:", stripeCustomerId);

          const { error } = await supabaseAdmin
            .from("businesses")
            .update({ subscription_status: "past_due" })
            .eq("id", businessId);

          if (error) throw error;
        }
      }
    }

    /**
     * 5) CONNECT ACCOUNT UPDATED (THIS FIXES YOUR "PENDING" CONNECT STATUS)
     *    Fires when connected account verification/capabilities change.
     */
    if (event.type === "account.updated") {
      const acct = event.data.object as Stripe.Account;

      const stripeAccountId = acct.id;
      const status = computeConnectStatus(acct);

      console.log("=== CONNECT ACCOUNT UPDATED ===");
      console.log("Stripe Account:", stripeAccountId);
      console.log("charges_enabled:", acct.charges_enabled);
      console.log("payouts_enabled:", acct.payouts_enabled);
      console.log("details_submitted:", acct.details_submitted);
      console.log("status:", status);

      // Find the business that owns this connected account
      const { data: row, error: rowErr } = await supabaseAdmin
        .from("stripe_connect_accounts")
        .select("business_id")
        .eq("stripe_account_id", stripeAccountId)
        .maybeSingle();

      if (rowErr) throw rowErr;

      if (row?.business_id) {
        const { error: upErr } = await supabaseAdmin
          .from("stripe_connect_accounts")
          .update({
            charges_enabled: acct.charges_enabled ?? false,
            payouts_enabled: acct.payouts_enabled ?? false,
            details_submitted: acct.details_submitted ?? false,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", row.business_id);

        if (upErr) throw upErr;
      } else {
        console.warn(
          "No stripe_connect_accounts row found for stripe_account_id:",
          stripeAccountId,
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Webhook handler failed";
    console.error("Webhook handler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
