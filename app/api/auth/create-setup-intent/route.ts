import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { businessId, email, ownerName } = await req.json();

  if (!businessId || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("stripe_customer_id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  let customerId = business.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: ownerName || business.name,
      metadata: { business_id: businessId },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", businessId);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: { business_id: businessId },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
