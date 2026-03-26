import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.redirect(
      new URL("/admin/payments?error=missing_business_id", req.url),
    );
  }

  const { data, error } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("business_id", businessId)
    .single();

  if (error || !data?.stripe_account_id) {
    return NextResponse.redirect(
      new URL("/admin/payments?error=no_stripe_account", req.url),
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${new URL(req.url).protocol}//${new URL(req.url).host}`;

  const link = await stripe.accountLinks.create({
    account: data.stripe_account_id,
    refresh_url: `${appUrl}/connect/refresh?businessId=${businessId}`,
    return_url: `${appUrl}/connect/return?businessId=${businessId}`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url);
}
