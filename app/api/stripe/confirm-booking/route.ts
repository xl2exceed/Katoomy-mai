// file: app/api/stripe/confirm-booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/webpush";
import { ensureUniqueReferralCode } from "@/lib/utils/generateReferralCode";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, slug } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session ID" },
        { status: 400 },
      );
    }

    // Get the connect account for this business slug
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, default_booking_status")
      .eq("slug", slug)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
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

    // Verify the Stripe session on the connected account
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      {
        stripeAccount: connectAccount.stripe_account_id,
      },
    );

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    }

    // Prevent duplicate bookings from double-processing
    const { data: existingBooking } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ bookingId: existingBooking.id });
    }

    // Extract metadata from the session
    const meta = session.metadata!;
    const {
      businessId,
      serviceId,
      customerName,
      customerPhone,
      customerEmail,
      bookingDate,
      bookingTime,
      startISO,
      durationMinutes,
      notes,
      priceCents,
      staffId,
      existingBookingId,
      referredByCode,
      vehicleType,
      vehicleCondition,
      addonIds: addonIdsRaw,
      customerAddress,
      travelFeeCents,
      smsConsent: smsConsentRaw,
    } = meta;
    const addonIds = addonIdsRaw ? JSON.parse(addonIdsRaw) : null;
    const smsConsent = smsConsentRaw === "true";

    // Upsert customer
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, sms_consent")
      .eq("business_id", businessId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const updatePayload: Record<string, unknown> = { full_name: customerName, email: customerEmail || null };
      if (smsConsent && !existingCustomer.sms_consent) {
        updatePayload.sms_consent = true;
        updatePayload.sms_consent_at = new Date().toISOString();
      }
      await supabaseAdmin.from("customers").update(updatePayload).eq("id", customerId);
    } else {
      const referralCode = await ensureUniqueReferralCode(
        supabaseAdmin,
        businessId,
        customerName,
        cleanPhone,
      );
      const { data: newCustomer } = await supabaseAdmin
        .from("customers")
        .insert({
          business_id: businessId,
          full_name: customerName,
          phone: cleanPhone,
          email: customerEmail || null,
          referral_code: referralCode,
          sms_consent: smsConsent ? true : false,
          sms_consent_at: smsConsent ? new Date().toISOString() : null,
        })
        .select()
        .single();
      customerId = newCustomer!.id;

      // Record referral if customer came via a referral link
      if (referredByCode) {
        const { data: referrer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("referral_code", referredByCode)
          .maybeSingle();
        if (referrer && referrer.id !== customerId) {
          await supabaseAdmin.from("referrals").insert({
            business_id: businessId,
            referrer_customer_id: referrer.id,
            referred_customer_id: customerId,
            referral_code: referredByCode,
            status: "pending",
          });
        }
      }
    }

    let bookingId: string;

    if (existingBookingId) {
      // Staff QR payment for an existing unpaid booking — update it, don't create a new one
      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          payment_status: "paid",
          status: "completed",
          stripe_session_id: sessionId,
          ...(staffId ? { staff_id: staffId } : {}),
        })
        .eq("id", existingBookingId);

      if (updateError) {
        console.error("Error updating booking:", updateError);
        return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
      }
      bookingId = existingBookingId;
    } else {
      // New booking (customer self-booked and paid online)
      const startDateTime = new Date(startISO || `${bookingDate}T${bookingTime}:00`);
      const endDateTime = new Date(
        startDateTime.getTime() + Number(durationMinutes) * 60000,
      );

      // For deposits: fullPriceCents = effectiveTotalCents() from client
      // = discounted service price + add-ons + travel fee (no platform fee).
      // The member discount was already applied client-side, so use it directly.
      const totalPriceCents = meta.paymentType === "deposit" ? Number(meta.fullPriceCents) : Number(priceCents);

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          service_id: serviceId,
          start_ts: startDateTime.toISOString(),
          end_ts: endDateTime.toISOString(),
          status: business.default_booking_status || "confirmed",
          total_price_cents: totalPriceCents,
          deposit_required: meta.paymentType === "deposit",
          deposit_amount_cents:
            meta.paymentType === "deposit" ? Number(meta.priceCents) : null,
          customer_notes: notes || null,
          stripe_session_id: sessionId,
          payment_status:
            meta.paymentType === "deposit" ? "deposit_paid" : "paid",
          staff_id: staffId || null,
          vehicle_type: vehicleType || null,
          vehicle_condition: vehicleCondition || null,
          addon_ids: addonIds && addonIds.length > 0 ? addonIds : null,
          customer_address: customerAddress || null,
          travel_fee_cents: travelFeeCents ? Number(travelFeeCents) : null,
        })
        .select()
        .single();

      if (bookingError) {
        console.error("Error creating booking:", bookingError);
        return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
      }
      bookingId = booking.id;

      // Seed Quick Book defaults on first booking
      try {
        const { count } = await supabaseAdmin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customerId)
          .eq("business_id", businessId)
          .neq("status", "cancelled");

        if (count === 1) {
          const startDt = new Date(startISO || `${bookingDate}T${bookingTime}:00`);
          const dayName = startDt.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
          await supabaseAdmin
            .from("customer_quick_book_defaults")
            .upsert(
              {
                customer_id: customerId,
                business_id: businessId,
                service_id: serviceId,
                staff_id: staffId || null,
                booking_time: bookingTime,
                booking_day_of_week: dayName,
                vehicle_type: vehicleType || null,
                vehicle_condition: vehicleCondition || null,
                addon_ids: addonIds && addonIds.length > 0 ? addonIds : [],
                updated_at: new Date().toISOString(),
              },
              { onConflict: "customer_id,business_id" }
            );
        }
      } catch (err) {
        console.error("Failed to seed quick book defaults (non-fatal):", err);
      }
    }

    // Record payment
    if (session.payment_intent) {
      await supabaseAdmin.from("payments").upsert(
        {
          business_id: businessId,
          booking_id: bookingId,
          stripe_payment_intent_id: session.payment_intent as string,
          amount_cents: Number(priceCents),
          status: "succeeded",
        },
        { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
      );
    }

    // Record in alternative_payment_ledger for tracking (full Stripe payments only — not deposits)
    // Deposits are recorded when the final balance is paid.
    if (meta.paymentType !== "deposit") {
      try {
        const { data: existingLedger } = await supabaseAdmin
          .from("alternative_payment_ledger")
          .select("id")
          .eq("booking_id", bookingId)
          .maybeSingle();
        if (!existingLedger) {
          const billingMonth = new Date().toISOString().slice(0, 7);
          await supabaseAdmin.from("alternative_payment_ledger").insert({
            business_id: businessId,
            booking_id: bookingId,
            customer_name: customerName,
            service_name: meta.serviceName,
            service_amount_cents: Number(priceCents),
            tip_cents: 0,
            platform_fee_cents: 0,
            payment_method: "card",
            fee_absorbed_by: "customer",
            billing_month: billingMonth,
            billing_status: "stripe_collected",
            notes: "Stripe card payment — fee collected automatically",
          });
        }
      } catch (err) {
        console.error("Failed to record ledger entry (non-fatal):", err);
      }
    }

    // Award loyalty points on payment (pre-paid new bookings and existing QR/card payments)
    try {
      const { data: loyalty, error: loyaltyErr } = await supabaseAdmin
        .from("loyalty_settings")
        .select("enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points")
        .eq("business_id", businessId)
        .single();

      console.log("[loyalty] bookingId:", bookingId, "customerId:", customerId, "businessId:", businessId);
      console.log("[loyalty] settings:", loyalty, "error:", loyaltyErr);

      if (loyalty?.enabled && loyalty.earn_on_completion) {
        const { data: existingPts } = await supabaseAdmin
          .from("loyalty_ledger").select("id")
          .eq("related_booking_id", bookingId).eq("event_type", "completion").maybeSingle();
        if (!existingPts) {
          const { error: insertErr } = await supabaseAdmin.from("loyalty_ledger").insert({
            business_id: businessId, customer_id: customerId,
            event_type: "completion", points_delta: loyalty.points_per_event,
            related_booking_id: bookingId,
          });
          console.log("[loyalty] completion insert error:", insertErr);
        }
      }

      if (loyalty?.referral_enabled !== false) {
        const { data: referral } = await supabaseAdmin
          .from("referrals").select("id, referrer_customer_id")
          .eq("business_id", businessId).eq("referred_customer_id", customerId).eq("status", "pending").maybeSingle();
        if (referral) {
          const referrerPoints = loyalty?.referrer_reward_points ?? 15;
          const { data: existingRef } = await supabaseAdmin
            .from("loyalty_ledger").select("id")
            .eq("related_booking_id", bookingId).eq("event_type", "referral")
            .eq("customer_id", referral.referrer_customer_id).maybeSingle();
          if (!existingRef) {
            const { error: refInsertErr } = await supabaseAdmin.from("loyalty_ledger").insert({
              business_id: businessId, customer_id: referral.referrer_customer_id,
              points_delta: referrerPoints, event_type: "referral", related_booking_id: bookingId,
            });
            console.log("[loyalty] referral insert error:", refInsertErr);
          }
          await supabaseAdmin.from("referrals").update({
            status: "completed", reward_points_awarded: referrerPoints,
            first_completed_booking_id: bookingId, completed_at: new Date().toISOString(),
          }).eq("id", referral.id);
        }
      }
    } catch (loyaltyEx) {
      console.error("[loyalty] unexpected error:", loyaltyEx);
    }

    // Notify customer that their payment was received (for staff QR payments)
    if (existingBookingId) {
      const { data: customerSubs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("customer_id", customerId)
        .eq("user_type", "customer");

      if (customerSubs && customerSubs.length > 0) {
        await Promise.all(
          customerSubs.map((sub) =>
            sendPushNotification(sub, {
              title: "Payment Received ✅",
              body: `Your payment of $${(Number(priceCents) / 100).toFixed(2)} has been processed. Thank you!`,
              url: `/${meta.slug}/dashboard`,
            }),
          ),
        );
      }

      await supabaseAdmin.from("notification_log").insert({
        target_type: "customer",
        customer_id: customerId,
        business_id: businessId,
        title: "Payment Received ✅",
        body: `Your payment of $${(Number(priceCents) / 100).toFixed(2)} has been processed. Thank you!`,
        url: `/${meta.slug}/dashboard`,
        read: false,
      });
    }

    // Notify business owner
    // Format from raw strings to avoid Vercel's UTC timezone offset
    const [hStr, mStr] = bookingTime.split(":");
    const h = parseInt(hStr);
    const timeLabel = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${mStr} ${h >= 12 ? "PM" : "AM"}`;
    const dateLabel = new Date(`${bookingDate}T00:00:00Z`).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" },
    );
    const apptTime = `${dateLabel} at ${timeLabel}`;

    const { data: bizSubscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("business_id", businessId)
      .eq("user_type", "business");

    if (bizSubscriptions && bizSubscriptions.length > 0) {
      await Promise.all(
        bizSubscriptions.map((sub) =>
          sendPushNotification(sub, {
            title: "New Booking 📅",
            body: `${customerName} booked ${meta.serviceName} on ${apptTime}`,
            url: "/admin/mobile/notifications",
          }),
        ),
      );
    }

    // Log notification
    await supabaseAdmin.from("notification_log").insert({
      target_type: "business",
      business_id: businessId,
      title: "New Booking 📅",
      body: `${customerName} booked ${meta.serviceName} on ${apptTime}`,
      url: "/admin/mobile/notifications",
      read: false,
    });

    // Schedule reminders
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/schedule-reminder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: bookingId,
            business_id: businessId,
          }),
        },
      );
    } catch (reminderErr) {
      console.error("Failed to schedule reminder (non-fatal):", reminderErr);
    }

    return NextResponse.json({ bookingId });
  } catch (err) {
    console.error("Confirm booking error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
