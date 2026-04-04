// POST /api/admin/custom-payment-card
// Creates a Stripe checkout session for a custom-amount credit card payment.
// Used when the payment method is "card" in the custom payment form.
// If bookingId is provided (custom-status booking), the Stripe success flow will
// mark the booking as custom_paid via confirm-service-payment.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, slug")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { serviceName, amountCents, tipCents, customerName, bookingId, staffId: bodyStaffId } = await req.json();
  // If no staffId passed in body, try to find the owner's own staff record
  let resolvedStaffId = bodyStaffId || "";
  if (!resolvedStaffId) {
    const { data: ownerStaff } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("business_id", business.id)
      .eq("user_id", user.id)
      .maybeSingle();
    resolvedStaffId = ownerStaff?.id || "";
  }
  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  // Get the business's Stripe connect account
  const { data: connectAccount } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("business_id", business.id)
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
  // so confirm-service-payment can mark the booking as custom_paid
  const successUrl = bookingId
    ? `${appUrl}/${business.slug}/pay-success?session_id={CHECKOUT_SESSION_ID}`
    : `${appUrl}/${business.slug}/dashboard`;

  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${appUrl}/admin/take-payment`,
      payment_intent_data: { application_fee_amount: platformFeeCents },
      metadata: {
        bookingId: bookingId || "",
        businessId: business.id,
        customerId: "",   // no customer auth for custom payments
        tipCents: String(safeTipCents),
        isCustomPayment: "true",
        customerName: customerName || "",
        staffId: resolvedStaffId,
      },
    },
    { stripeAccount: connectAccount.stripe_account_id },
  );

  return NextResponse.json({ url: session.url });
}
