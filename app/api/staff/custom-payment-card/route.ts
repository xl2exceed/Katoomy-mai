// POST /api/staff/custom-payment-card
// Creates a Stripe checkout session for a custom-amount credit card payment.
// Auth via Bearer token (staff JWT).
// If bookingId is provided (custom-status booking), the Stripe success flow will
// mark the booking as custom_paid via confirm-service-payment.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, business_id, businesses(slug)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const businessSlug = (staff.businesses as unknown as { slug: string } | null)?.slug || "";

  const { serviceName, amountCents, tipCents, customerName, bookingId } = await req.json();
  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  // Get the business's Stripe connect account
  const { data: connectAccount } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("business_id", staff.business_id)
    .eq("charges_enabled", true)
    .single();

  if (!connectAccount?.stripe_account_id) {
    return NextResponse.json({ error: "Business is not set up to accept card payments" }, { status: 400 });
  }

  const safeTipCents = tipCents && tipCents > 0 ? tipCents : 0;
  const totalCents = amountCents + safeTipCents;
  const platformFeeCents = Math.round(totalCents * 0.015);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: serviceName.trim() },
        unit_amount: amountCents,
      },
      quantity: 1,
    },
  ];

  if (safeTipCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Tip" },
        unit_amount: safeTipCents,
      },
      quantity: 1,
    });
  }

  // If linked to a booking, route through the standard pay-success flow
  const successUrl = bookingId
    ? `${appUrl}/${businessSlug}/pay-success?session_id={CHECKOUT_SESSION_ID}`
    : `${appUrl}/staff/payment`;

  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${appUrl}/staff/payment`,
      payment_intent_data: { application_fee_amount: platformFeeCents },
      metadata: {
        bookingId: bookingId || "",
        businessId: staff.business_id,
        customerId: "",
        tipCents: String(safeTipCents),
        isCustomPayment: "true",
        customerName: customerName || "",
        staffId: staff.id,
      },
    },
    { stripeAccount: connectAccount.stripe_account_id },
  );

  return NextResponse.json({ url: session.url });
}
