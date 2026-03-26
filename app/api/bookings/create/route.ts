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
    } = await req.json();

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
      .select("id")
      .eq("business_id", businessId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabaseAdmin
        .from("customers")
        .update({ full_name: customerName, email: customerEmail || null })
        .eq("id", customerId);
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
        })
        .select()
        .single();
      customerId = newCustomer!.id;
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
