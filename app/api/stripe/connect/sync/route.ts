import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- Helpers ---
function missingEnv(name: string) {
  return NextResponse.json(
    { error: `Missing environment variable: ${name}` },
    { status: 500 },
  );
}

function computeStatus(a: Stripe.Account) {
  if (a.charges_enabled && a.payouts_enabled) return "active";
  if (a.details_submitted) return "restricted"; // submitted but not enabled yet
  return "pending";
}

// --- Handler ---
export async function POST(req: Request) {
  try {
    // 0) Env checks (prevents silent 500s)
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!STRIPE_SECRET_KEY) return missingEnv("STRIPE_SECRET_KEY");
    if (!SUPABASE_URL) return missingEnv("NEXT_PUBLIC_SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY)
      return missingEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );

    const body = await req.json().catch(() => ({}));
    const businessId = body?.businessId;

    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 },
      );
    }

    // 1) Get stripe_account_id for this business
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("business_id", businessId)
      .maybeSingle();

    if (rowErr) {
      console.error("[connect/sync] supabase select error", {
        businessId,
        rowErr,
      });
      return NextResponse.json(
        { error: `Supabase select failed: ${rowErr.message}` },
        { status: 500 },
      );
    }

    if (!row?.stripe_account_id) {
      return NextResponse.json(
        { error: "No stripe_account_id found for business" },
        { status: 404 },
      );
    }

    // 2) Retrieve Stripe account
    let acct: Stripe.Account;
    try {
      acct = await stripe.accounts.retrieve(row.stripe_account_id);
    } catch (stripeErr) {
      console.error("[connect/sync] stripe retrieve error", {
        businessId,
        stripe_account_id: row.stripe_account_id,
        stripeErr,
      });
      const msg =
        stripeErr instanceof Error
          ? stripeErr.message
          : "Stripe retrieve failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const status = computeStatus(acct);

    // 3) Update your table
    const updatePayload = {
      charges_enabled: acct.charges_enabled ?? false,
      payouts_enabled: acct.payouts_enabled ?? false,
      details_submitted: acct.details_submitted ?? false,
      status,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .update(updatePayload)
      .eq("business_id", businessId);

    if (upErr) {
      console.error("[connect/sync] supabase update error", {
        businessId,
        stripe_account_id: row.stripe_account_id,
        updatePayload,
        upErr,
      });
      return NextResponse.json(
        { error: `Supabase update failed: ${upErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      businessId,
      stripe_account_id: row.stripe_account_id,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
      status,
    });
  } catch (e: unknown) {
    console.error("[connect/sync] unexpected error", e);
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
