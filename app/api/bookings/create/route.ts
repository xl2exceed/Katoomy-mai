// file: app/api/bookings/create/route.ts
// Creates a booking without payment (cash / pay at appointment)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/webpush";
import { ensureUniqueReferralCode } from "@/lib/utils/generateReferralCode";

export async function POST(req: NextRequest) {
  try {
    const {
      businessId,
      serviceId,
      serviceName,
      priceCents,
      customerName,
      customerPhone,
      customerEmail,
      bookingDate,
      bookingTime,
      startISO,
      durationMinutes,
      notes,
      defaultBookingStatus,
      staffId,
      referredByCode,
      // Car wash fields
      vehicleType,
      vehicleCondition,
      addonIds,
      customerAddress,
      travelFeeCents,
      // Legacy field kept for backward compat — new fields below take precedence
      smsConsent,
      smsTransactionalConsent,
      smsMarketingConsent,
    } = await req.json();

    // Resolve consent: new split fields take precedence over legacy smsConsent
    const hasTransactionalConsent = smsTransactionalConsent !== undefined
      ? Boolean(smsTransactionalConsent)
      : Boolean(smsConsent);
    const hasMarketingConsent = smsMarketingConsent !== undefined
      ? Boolean(smsMarketingConsent)
      : Boolean(smsConsent);

    if (
      !businessId ||
      !serviceId ||
      !customerPhone ||
      !bookingDate ||
      !bookingTime
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");

    // Upsert customer
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, sms_consent, sms_transactional_consent, sms_marketing_consent")
      .eq("business_id", businessId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    const now = new Date().toISOString();
    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const updatePayload: Record<string, unknown> = { full_name: customerName, email: customerEmail || null };
      // Only upgrade consent — never downgrade an existing opt-in
      if (hasTransactionalConsent && !existingCustomer.sms_transactional_consent) {
        updatePayload.sms_transactional_consent = true;
        updatePayload.sms_transactional_consent_at = now;
      }
      if (hasMarketingConsent && !existingCustomer.sms_marketing_consent) {
        updatePayload.sms_marketing_consent = true;
        updatePayload.sms_marketing_consent_at = now;
      }
      // Keep legacy sms_consent in sync for backward compat
      if ((hasTransactionalConsent || hasMarketingConsent) && !existingCustomer.sms_consent) {
        updatePayload.sms_consent = true;
        updatePayload.sms_consent_at = now;
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
          sms_consent: hasTransactionalConsent || hasMarketingConsent,
          sms_consent_at: (hasTransactionalConsent || hasMarketingConsent) ? now : null,
          sms_transactional_consent: hasTransactionalConsent,
          sms_transactional_consent_at: hasTransactionalConsent ? now : null,
          sms_marketing_consent: hasMarketingConsent,
          sms_marketing_consent_at: hasMarketingConsent ? now : null,
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

    // Create booking
    const startDateTime = new Date(startISO || `${bookingDate}T${bookingTime}:00`);
    const endDateTime = new Date(
      startDateTime.getTime() + Number(durationMinutes) * 60000,
    );

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        service_id: serviceId,
        start_ts: startDateTime.toISOString(),
        end_ts: endDateTime.toISOString(),
        status: defaultBookingStatus || "confirmed",
        total_price_cents: priceCents,
        deposit_required: false,
        deposit_amount_cents: null,
        customer_notes: notes || null,
        payment_status: "unpaid",
        staff_id: staffId || null,
        // Car wash fields (null for non-carwash bookings)
        vehicle_type: vehicleType || null,
        vehicle_condition: vehicleCondition || null,
        addon_ids: addonIds && addonIds.length > 0 ? addonIds : null,
        customer_address: customerAddress || null,
        travel_fee_cents: travelFeeCents || null,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("Error creating booking:", bookingError);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 },
      );
    }

    // Seed Quick Book defaults — upsert only if no row exists yet so customer
    // edits are never overwritten, but returning customers who missed the first-
    // booking seed still get populated.
    try {
      const { data: existingDefaults } = await supabaseAdmin
        .from("customer_quick_book_defaults")
        .select("id")
        .eq("customer_id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!existingDefaults) {
        const startDt = new Date(startISO || `${bookingDate}T${bookingTime}:00`);
        const dayName = startDt.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        await supabaseAdmin
          .from("customer_quick_book_defaults")
          .insert({
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
          });
      }
    } catch (err) {
      console.error("Failed to seed quick book defaults (non-fatal):", err);
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
            body: `${customerName} booked ${serviceName} on ${apptTime}`,
            url: "/admin/mobile/notifications",
          }),
        ),
      );
    }

    await supabaseAdmin.from("notification_log").insert({
      target_type: "business",
      business_id: businessId,
      title: "New Booking 📅",
      body: `${customerName} booked ${serviceName} on ${apptTime}`,
      url: "/admin/mobile/notifications",
      read: false,
    });

    // Notify customer — push + notification_log so it shows in the bell
    const { data: bizForSlug } = await supabaseAdmin
      .from("businesses").select("slug").eq("id", businessId).maybeSingle();
    const bizSlug = bizForSlug?.slug;

    const { data: customerSubs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("customer_id", customerId)
      .eq("user_type", "customer");

    if (customerSubs && customerSubs.length > 0) {
      await Promise.all(
        customerSubs.map((sub) =>
          sendPushNotification(sub, {
            title: "Booking Confirmed 📅",
            body: `Your ${serviceName} appointment is confirmed for ${apptTime}.`,
            url: bizSlug ? `/${bizSlug}/dashboard` : "/",
          }),
        ),
      );
    }

    await supabaseAdmin.from("notification_log").insert({
      target_type: "customer",
      customer_id: customerId,
      business_id: businessId,
      title: "Booking Confirmed 📅",
      body: `Your ${serviceName} appointment is confirmed for ${apptTime}.`,
      url: bizSlug ? `/${bizSlug}/dashboard` : "/",
      read: false,
    });

    // Notify assigned staff member
    if (staffId) {
      const { data: staffSubs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("staff_id", staffId)
        .eq("user_type", "staff");

      if (staffSubs && staffSubs.length > 0) {
        await Promise.all(
          staffSubs.map((sub) =>
            sendPushNotification(sub, {
              title: "New Booking 📅",
              body: `${customerName} booked ${serviceName} on ${apptTime}`,
              url: "/staff/dashboard",
            }),
          ),
        );
      }
    }

    // Schedule reminders
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/schedule-reminder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: booking.id,
            business_id: businessId,
          }),
        },
      );
    } catch (err) {
      console.error("Failed to schedule reminder (non-fatal):", err);
    }

    return NextResponse.json({ bookingId: booking.id });
  } catch (err) {
    console.error("Create booking error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
