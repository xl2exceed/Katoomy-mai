// file: app/api/stripe/connect/start/route.ts
// Creates a new Stripe Connect account for a business (or gets the existing one)
// and returns a Stripe account-link URL for onboarding.
// Replaces the stripe-connect-start Supabase Edge Function.

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function missingEnv(name: string) {
  return NextResponse.json({ error: `Missing env var: ${name}` }, { status: 500 });
}

function computeStatus(a: Stripe.Account) {
  if (a.charges_enabled && a.payouts_enabled) return "active";
  if (a.details_submitted) return "restricted";
  return "pending";
}

export async function POST(req: Request) {
  try {
    const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

    if (!STRIPE_KEY) return missingEnv("STRIPE_SECRET_KEY");
    if (!SUPABASE_URL) return missingEnv("NEXT_PUBLIC_SUPABASE_URL");
    if (!SERVICE_ROLE_KEY) return missingEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Verify the user is authenticated
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up the business owned by this user (never trust client-supplied business_id)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: business, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (bizErr || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = business.id;
    const stripe = new Stripe(STRIPE_KEY);

    // Check if a Stripe Connect account already exists for this business
    const { data: existing } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", businessId)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      // Create a new Stripe Connect standard account
      const account = await stripe.accounts.create({ type: "standard" });
      accountId = account.id;

      await supabaseAdmin.from("stripe_connect_accounts").insert({
        business_id: businessId,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        status: "pending",
      });
    } else {
      // Sync latest status from Stripe before redirecting
      try {
        const acct = await stripe.accounts.retrieve(accountId);
        await supabaseAdmin.from("stripe_connect_accounts").update({
          charges_enabled: acct.charges_enabled ?? false,
          payouts_enabled: acct.payouts_enabled ?? false,
          details_submitted: acct.details_submitted ?? false,
          status: computeStatus(acct),
          updated_at: new Date().toISOString(),
        }).eq("business_id", businessId);
      } catch {
        // Non-fatal: sync failure shouldn't block the redirect
      }
    }

    // Create the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/connect/refresh?businessId=${businessId}`,
      return_url: `${APP_URL}/connect/return?businessId=${businessId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url, accountId });
  } catch (e: unknown) {
    console.error("[stripe/connect/start] error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
