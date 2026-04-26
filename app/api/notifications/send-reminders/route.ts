// file: app/api/notifications/send-reminders/route.ts
// Vercel cron endpoint — runs every hour, fires due reminders

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/webpush";
import { getSmsTemplate, fillSmsTemplate } from "@/lib/smsTemplates";

export const runtime = "nodejs";

interface ReminderRow {
  id: string;
  type: string;
  channel: string;
  scheduled_for: string;
  booking_id: string;
  business_id: string;
  customer_id: string;
  bookings: {
    start_ts: string;
    status: string;
    services: { name: string } | null;
  } | null;
  customers: {
    full_name: string | null;
    phone: string;
    sms_transactional_consent: boolean | null;
    sms_consent: boolean | null; // legacy fallback
  } | null;
  businesses: {
    name: string;
    slug: string;
    timezone: string | null;
  } | null;
}

export async function GET(req: NextRequest) {
  // Verify this is being called by Vercel cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: rawReminders, error: fetchError } = await supabase
    .from("scheduled_notifications")
    .select(
      `
      id,
      type,
      channel,
      scheduled_for,
      booking_id,
      business_id,
      customer_id,
      bookings (
        start_ts,
        status,
        services ( name )
      ),
      customers (
        full_name,
        phone,
        sms_transactional_consent,
        sms_consent
      ),
      businesses (
        name,
        slug,
        timezone
      )
    `,
    )
    .eq("status", "pending")
    .lte("scheduled_for", windowEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  if (fetchError) {
    console.error("Error fetching due reminders:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 },
    );
  }

  if (!rawReminders || rawReminders.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  const dueReminders = rawReminders as unknown as ReminderRow[];

  // Base URL for internal API calls — matches the running deployment
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy-mai.vercel.app";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const booking = reminder.bookings;
    const customer = reminder.customers;
    const business = reminder.businesses;

    // Skip if booking was cancelled
    if (!booking || booking.status === "cancelled") {
      await supabase
        .from("scheduled_notifications")
        .update({ status: "skipped", sent_at: now.toISOString() })
        .eq("id", reminder.id);
      skipped++;
      continue;
    }

    // Format appointment time in the business's local timezone (not UTC)
    const tz = business?.timezone || "America/New_York";
    const apptTime = new Date(booking.start_ts).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });

    const serviceName = booking.services?.name || "appointment";
    const customerName = customer?.full_name || "there";

    try {
      if (reminder.channel === "push") {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("customer_id", reminder.customer_id)
          .eq("user_type", "customer");

        if (!subscriptions || subscriptions.length === 0) {
          await supabase
            .from("scheduled_notifications")
            .update({ status: "skipped", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        const expiredEndpoints: string[] = [];

        await Promise.all(
          subscriptions.map(async (sub) => {
            const result = await sendPushNotification(sub, {
              title: `⏰ Reminder: ${serviceName}`,
              body: `Hi ${customerName}! Your appointment is in 2 hours — ${apptTime}. See you soon!`,
              url: business ? `/${business.slug}/dashboard` : "/",
            });
            if (!result.success && result.expired) {
              expiredEndpoints.push(sub.endpoint);
            }
          }),
        );

        if (expiredEndpoints.length > 0) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .in("endpoint", expiredEndpoints);
        }

        // Log to notification_log so it shows in the in-app notification bell
        await supabase.from("notification_log").insert({
          target_type: "customer",
          customer_id: reminder.customer_id,
          business_id: reminder.business_id,
          title: `⏰ Reminder: ${serviceName}`,
          body: `Hi ${customerName}! Your appointment is in 2 hours — ${apptTime}. See you soon!`,
          url: business ? `/${business.slug}/dashboard` : "/",
          read: false,
        });
      } else if (reminder.channel === "sms") {
        if (!customer?.phone) {
          await supabase
            .from("scheduled_notifications")
            .update({ status: "skipped", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        // 10DLC compliance: only send SMS reminders to customers who opted in to transactional messages.
        // Fall back to legacy sms_consent for customers who booked before the consent split.
        const hasTransactionalConsent = customer.sms_transactional_consent ?? customer.sms_consent ?? false;
        if (!hasTransactionalConsent) {
          await supabase
            .from("scheduled_notifications")
            .update({ status: "skipped", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        const tmpl = await getSmsTemplate(reminder.business_id, "reminder");
        const smsBody = fillSmsTemplate(tmpl, {
          customer_name: customerName,
          service_name: serviceName,
          appt_time: apptTime,
        });

        // Call /api/sms/send — same path used by cancellations (proven to work).
        // It handles E.164 normalization, Twilio send, and sms_messages logging internally.
        const smsRes = await fetch(`${appUrl}/api/sms/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customer.phone,
            body: smsBody,
            business_id: reminder.business_id,
            customer_id: reminder.customer_id,
          }),
        });

        if (!smsRes.ok) {
          const errData = await smsRes.json().catch(() => ({}));
          throw new Error(`sms/send failed: ${JSON.stringify(errData)}`);
        }
      }

      await supabase
        .from("scheduled_notifications")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", reminder.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);
      await supabase
        .from("scheduled_notifications")
        .update({ status: "failed" })
        .eq("id", reminder.id);
      failed++;
    }
  }

  console.log(`Reminders: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return NextResponse.json({ success: true, sent, failed, skipped });
}
