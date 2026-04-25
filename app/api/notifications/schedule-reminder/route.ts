// file: app/api/notifications/schedule-reminder/route.ts
// Called after a booking is created — saves reminder times to DB

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { appointment_id, business_id } = await req.json();

    if (!appointment_id || !business_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin;

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, customer_id, business_id, start_ts, status")
      .eq("id", appointment_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Don't schedule reminders for cancelled bookings
    if (booking.status === "cancelled") {
      return NextResponse.json({ success: true, scheduled: 0 });
    }

    const startTs = new Date(booking.start_ts);
    const now = new Date();

    const reminders = [];

    // 24-hour SMS reminder
    const reminder24h = new Date(startTs.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > now) {
      reminders.push({
        booking_id: booking.id,
        business_id: booking.business_id,
        customer_id: booking.customer_id,
        type: "reminder_24h",
        channel: "sms",
        scheduled_for: reminder24h.toISOString(),
        status: "pending",
      });
    }

    // 2-hour push notification reminder
    const reminder2h = new Date(startTs.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      reminders.push({
        booking_id: booking.id,
        business_id: booking.business_id,
        customer_id: booking.customer_id,
        type: "reminder_2h",
        channel: "push",
        scheduled_for: reminder2h.toISOString(),
        status: "pending",
      });
    }

    if (reminders.length === 0) {
      return NextResponse.json({
        success: true,
        scheduled: 0,
        reason: "Appointment too soon",
      });
    }

    const { error: insertError } = await supabase
      .from("scheduled_notifications")
      .insert(reminders);

    if (insertError) {
      console.error("Error scheduling reminders:", insertError);
      return NextResponse.json(
        { error: "Failed to schedule reminders" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, scheduled: reminders.length });
  } catch (err) {
    console.error("Schedule reminder error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
