import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// IMPORTANT:
// If your project has a custom Stripe type somewhere that forces
// apiVersion to "2025-12-15.clover", do NOT set apiVersion here.
// Let the SDK default, which avoids the TS mismatch.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Your env vars (4 prices)
const PRO_MONTHLY = process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
const PRO_ANNUAL = process.env.STRIPE_PRO_ANNUAL_PRICE_ID!;
const PREMIUM_MONTHLY = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!;
const PREMIUM_ANNUAL = process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID!;

type Plan = "pro" | "premium";
type Interval = "monthly" | "annual";

function mapPriceToPlan(
  priceId: string | null,
): { plan: Plan; interval: Interval } | null {
  if (!priceId) return null;

  if (priceId === PRO_MONTHLY) return { plan: "pro", interval: "monthly" };
  if (priceId === PRO_ANNUAL) return { plan: "pro", interval: "annual" };
  if (priceId === PREMIUM_MONTHLY)
    return { plan: "premium", interval: "monthly" };
  if (priceId === PREMIUM_ANNUAL)
    return { plan: "premium", interval: "annual" };

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get("session_id");

    if (!session_id) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 },
      );
    }

    // Expand line_items so we can get the purchased price id
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price"],
    });

    const priceId =
      session.line_items?.data?.[0]?.price &&
      typeof session.line_items.data[0].price !== "string"
        ? session.line_items.data[0].price.id
        : null;

    const mapped = mapPriceToPlan(priceId);

    return NextResponse.json({
      plan: mapped?.plan ?? null,
      interval: mapped?.interval ?? null,
      priceId,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
