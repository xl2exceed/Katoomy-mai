// file: supabase/functions/stripe-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or secret", { status: 400 });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await supabaseClient
          .from("stripe_connect_accounts")
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            status: account.charges_enabled ? "connected" : "pending",
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { data: payment } = await supabaseClient
          .from("payments")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .select("booking_id")
          .single();

        if (payment) {
          // Update booking status
          await supabaseClient
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", payment.booking_id);

          // Check referral eligibility
          const { data: booking } = await supabaseClient
            .from("bookings")
            .select("customer_id, business_id")
            .eq("id", payment.booking_id)
            .single();

          if (booking) {
            // Find referral where this customer was referred
            const { data: referral } = await supabaseClient
              .from("referrals")
              .select("*")
              .eq("referred_customer_id", booking.customer_id)
              .eq("status", "booked")
              .single();

            if (referral) {
              await supabaseClient
                .from("referrals")
                .update({ status: "paid" })
                .eq("id", referral.id);
            }
          }
        }
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabaseClient
          .from("payments")
          .update({ status: event.type === "payment_intent.canceled" ? "canceled" : "requires_payment_method" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});