// file: app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStripeForAccount } from "@/lib/stripe/getStripeForAccount";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const {
      businessId,
      serviceId,
      serviceName,
      priceCents,
      fullPriceCents,
      paymentType,
      customerFirstName,
      customerLastName,
      customerName: customerNameRaw,
      customerPhone,
      customerEmail,
      bookingDate,
      bookingTime,
      startISO,
      durationMinutes,
      notes,
      slug,
      staffId,
      referredByCode,
      // Car wash fields
      vehicleType,
      vehicleCondition,
      addonIds,
      customerAddress,
      travelFeeCents,
      smsConsent,
      smsTransactionalConsent,
      smsMarketingConsent,
      netRefOfferId,
      netRefVia,
      bizRefId,
      customerTimezone,
    } = await req.json();

    const firstName = customerFirstName?.trim() || (customerNameRaw ? customerNameRaw.split(" ")[0] : "");
    const lastName = customerLastName?.trim() || (customerNameRaw && customerNameRaw.includes(" ") ? customerNameRaw.slice(customerNameRaw.indexOf(" ") + 1).trim() : "");
    const customerName = [firstName, lastName].filter(Boolean).join(" ");

    if (!businessId || !serviceId || !priceCents || !slug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("business_id", businessId)
      .eq("charges_enabled", true)
      .single();

    if (!connectAccount?.stripe_account_id) {
      return NextResponse.json(
        { error: "Business is not set up to accept payments" },
        { status: 400 },
      );
    }

    const stripe = await getStripeForAccount(connectAccount.stripe_account_id);

    // fullPriceCents is sent from the client already discounted for members.
    // Server only needs to re-verify and apply discount to the CHARGE amount for full payments.
    let effectivePriceCents = priceCents;
    const effectiveFullPriceCents = Number(fullPriceCents || priceCents);
    if (customerPhone && paymentType !== "deposit") {
      const cleanPhone = String(customerPhone).replace(/\D/g, "");
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", cleanPhone)
        .maybeSingle();
      if (customer) {
        const { data: sub } = await supabaseAdmin
          .from("member_subscriptions")
          .select("plan_id")
          .eq("customer_id", customer.id)
          .eq("business_id", businessId)
          .eq("status", "active")
          .maybeSingle();
        if (sub?.plan_id) {
          const { data: plan } = await supabaseAdmin
            .from("membership_plans")
            .select("discount_percent")
            .eq("id", sub.plan_id)
            .single();
          if (plan && plan.discount_percent > 0) {
            effectivePriceCents = Math.round(priceCents * (1 - plan.discount_percent / 100));
          }
        }
      }
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

    // Add the $1 platform fee to the Stripe charge when the customer absorbs it
    const { data: cashSettings } = await supabaseAdmin
      .from("cashapp_settings")
      .select("fee_mode")
      .eq("business_id", businessId)
      .maybeSingle();
      // Skip $1 platform fee on deposit payments — it will be charged on the final payment
    const feeModeCents = (cashSettings?.fee_mode === "business_absorbs" || paymentType === "deposit") ? 0 : 100;
    const chargeAmountCents = effectivePriceCents + feeModeCents;
    const platformFeeCents = Math.round(chargeAmountCents * 0.015) + feeModeCents;

    const lineItemName =
      paymentType === "deposit" ? `Deposit for ${serviceName}` : serviceName;

    const lineItemDesc =
      paymentType === "deposit"
        ? `Deposit for appointment on ${bookingDate} at ${bookingTime}. Remainder due at appointment.`
        : `Appointment on ${bookingDate} at ${bookingTime}`;

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: lineItemName,
                description: lineItemDesc,
              },
              unit_amount: chargeAmountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${appUrl}/${slug}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${slug}/customer-info`,
        customer_email: customerEmail || undefined,
        payment_intent_data: {
          application_fee_amount: platformFeeCents,
        },
        metadata: {
          businessId,
          serviceId,
          serviceName,
          priceCents: String(effectivePriceCents),
          fullPriceCents: String(effectiveFullPriceCents),
          paymentType: paymentType || "full",
          customerFirstName: firstName || "",
          customerLastName: lastName || "",
          customerName,
          customerPhone,
          customerEmail: customerEmail || "",
          bookingDate,
          bookingTime,
          startISO: startISO || "",
          durationMinutes: String(durationMinutes),
          notes: notes || "",
          slug,
          staffId: staffId || "",
          referredByCode: referredByCode || "",
          vehicleType: vehicleType || "",
          vehicleCondition: vehicleCondition || "",
          addonIds: addonIds ? JSON.stringify(addonIds) : "",
          customerAddress: customerAddress || "",
          travelFeeCents: String(travelFeeCents || 0),
          smsConsent: smsConsent ? "true" : "false",
          smsTransactionalConsent: smsTransactionalConsent ? "true" : "false",
          smsMarketingConsent: smsMarketingConsent ? "true" : "false",
          netRefOfferId: netRefOfferId || "",
          netRefVia: netRefVia || "",
          bizRefId: bizRefId || "",
          customerTimezone: customerTimezone || "",
        },
      },
      {
        stripeAccount: connectAccount.stripe_account_id,
      },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
