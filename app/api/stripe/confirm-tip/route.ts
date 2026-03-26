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
        { error: "No connect account found" },
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: connectAccount.stripe_account_id },
    );

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    }

    // Idempotency guard — same pattern as confirm-booking
    const { data: existingTip } = await supabaseAdmin
      .from("tips")
      .select("id, amount_cents")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingTip) {
      return NextResponse.json({
        tipId: existingTip.id,
        amountCents: existingTip.amount_cents,
      });
    }

    const meta = session.metadata!;
    const { bookingId, businessId, tipAmountCents } = meta;

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("customer_id")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { data: tip, error: tipError } = await supabaseAdmin
      .from("tips")
      .insert({
        business_id: businessId,
        booking_id: bookingId,
        customer_id: booking.customer_id,
        amount_cents: Number(tipAmountCents),
        stripe_session_id: sessionId,
        stripe_tip_intent_id: session.payment_intent as string,
        status: "paid",
      })
      .select()
      .single();

    if (tipError) {
      console.error("Error creating tip record:", tipError);
      return NextResponse.json(
        { error: "Failed to store tip" },
        { status: 500 },
      );
    }

    return NextResponse.json({ tipId: tip.id, amountCents: tip.amount_cents });
  } catch (err) {
    console.error("Confirm tip error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
