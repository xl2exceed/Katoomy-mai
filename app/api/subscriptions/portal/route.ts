// app/api/subscriptions/portal/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { businessId } = await req.json();

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 },
      );
    }

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .select("stripe_customer_id")
      .eq("id", businessId)
      .single();

    if (bizErr || !biz?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this business." },
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: biz.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create portal session";
    console.error("Portal session error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
