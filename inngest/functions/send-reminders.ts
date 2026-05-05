import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/webpush";
import { getSmsTemplate, fillSmsTemplate } from "@/lib/smsTemplates";

interface ReminderRow {
  id: string;
  type: string;
  channel: string;
  scheduled_for: string;
  booking_id: string;
  business_id: string;
  customer_id: string;
  bookings: { start_ts: string; status: string; services: { name: string } | null } | null;
  customers: {
    full_name: string | null;
    phone: string;
    sms_transactional_consent: boolean | null;
    sms_consent: boolean | null;
  } | null;
  businesses: { name: string; slug: string; timezone: string | null } | null;
}

export const sendReminders = inngest.createFunction(
  { id: "send-reminders", name: "Push Notification Reminders", retries: 3, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

    const dueReminders = await step.run("fetch-due-reminders", async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("scheduled_notifications")
        .select(`
          id, type, channel, scheduled_for, booking_id, business_id, customer_id,
          bookings ( start_ts, status, services ( name ) ),
          customers ( full_name, phone, sms_transactional_consent, sms_consent ),
          businesses ( name, slug, timezone )
        `)
        .eq("status", "pending")
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ReminderRow[];
    });

    if (dueReminders.length === 0) return { processed: 0, sent: 0, failed: 0, skipped: 0 };

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const reminder of dueReminders) {
      const outcome = await step.run(`process-reminder-${reminder.id}`, async () => {
        const now = new Date().toISOString();
        const booking = reminder.bookings;
        const customer = reminder.customers;
        const business = reminder.businesses;

        if (!booking || booking.status === "cancelled") {
          await supabaseAdmin
            .from("scheduled_notifications")
            .update({ status: "skipped", sent_at: now })
            .eq("id", reminder.id);
          return "skipped" as const;
        }

        const tz = business?.timezone || "America/New_York";
        const apptTime = new Date(booking.start_ts).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: tz,
        });
        const serviceName = booking.services?.name || "appointment";
        const customerName = customer?.full_name || "there";

        try {
          if (reminder.channel === "push") {
            const { data: subscriptions } = await supabaseAdmin
              .from("push_subscriptions")
              .select("endpoint, p256dh, auth")
              .eq("customer_id", reminder.customer_id)
              .eq("user_type", "customer");

            if (!subscriptions || subscriptions.length === 0) {
              await supabaseAdmin
                .from("scheduled_notifications")
                .update({ status: "skipped", sent_at: now })
                .eq("id", reminder.id);
              return "skipped" as const;
            }

            const expiredEndpoints: string[] = [];
            await Promise.all(
              subscriptions.map(async (sub) => {
                const result = await sendPushNotification(sub, {
                  title: `⏰ Reminder: ${serviceName}`,
                  body: `Hi ${customerName}! Your appointment is in 2 hours — ${apptTime}. See you soon!`,
                  url: business ? `/${business.slug}/dashboard` : "/",
                });
                if (!result.success && result.expired) expiredEndpoints.push(sub.endpoint);
              }),
            );

            if (expiredEndpoints.length > 0) {
              await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
            }

            await supabaseAdmin.from("notification_log").insert({
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
              await supabaseAdmin
                .from("scheduled_notifications")
                .update({ status: "skipped", sent_at: now })
                .eq("id", reminder.id);
              return "skipped" as const;
            }

            const hasConsent = customer.sms_transactional_consent ?? customer.sms_consent ?? false;
            if (!hasConsent) {
              await supabaseAdmin
                .from("scheduled_notifications")
                .update({ status: "skipped", sent_at: now })
                .eq("id", reminder.id);
              return "skipped" as const;
            }

            const tmpl = await getSmsTemplate(reminder.business_id, "reminder");
            const smsBody = fillSmsTemplate(tmpl, {
              customer_name: customerName,
              service_name: serviceName,
              appt_time: apptTime,
            });

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

          await supabaseAdmin
            .from("scheduled_notifications")
            .update({ status: "sent", sent_at: now })
            .eq("id", reminder.id);

          return "sent" as const;
        } catch (err) {
          console.error(`Failed to send reminder ${reminder.id}:`, err);
          await supabaseAdmin
            .from("scheduled_notifications")
            .update({ status: "failed" })
            .eq("id", reminder.id);
          return "failed" as const;
        }
      });

      if (outcome === "sent") sent++;
      else if (outcome === "failed") failed++;
      else skipped++;
    }

    return { processed: dueReminders.length, sent, failed, skipped };
  },
);
