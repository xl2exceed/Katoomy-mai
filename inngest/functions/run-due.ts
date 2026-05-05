import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getRouting } from "@/lib/twilio";

export const runDue = inngest.createFunction(
  { id: "run-due", name: "SMS Appointment Reminders", retries: 3, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const dueMessages = await step.run("fetch-due-messages", async () => {
      const { data, error } = await supabaseAdmin
        .from("scheduled_messages")
        .select("*")
        .eq("status", "scheduled")
        .lte("run_at", new Date().toISOString())
        .order("run_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    });

    if (dueMessages.length === 0) return { processed: 0, sent: 0, failed: 0 };

    const mode = (process.env.TWILIO_MODE || "TEST") as "TEST" | "LIVE";
    const { client: twilio } = getTwilio();
    const routing = getRouting(mode);

    let sent = 0;
    let failed = 0;

    for (const msg of dueMessages) {
      const outcome = await step.run(`process-message-${msg.id}`, async () => {
        try {
          await supabaseAdmin
            .from("scheduled_messages")
            .update({ status: "processing" })
            .eq("id", msg.id);

          const twilioMessage = await twilio.messages.create({
            to: msg.to_number,
            ...routing,
            body: msg.body,
          });

          const { data: smsRecord } = await supabaseAdmin
            .from("sms_messages")
            .insert({
              business_id: msg.business_id,
              direction: "outbound",
              to_number: msg.to_number,
              from_number: "from" in routing ? routing.from : "messagingService",
              body: msg.body,
              status: twilioMessage.status || "queued",
              provider: "twilio",
              provider_message_id: twilioMessage.sid,
            })
            .select()
            .single();

          await supabaseAdmin
            .from("scheduled_messages")
            .update({ status: "sent", sent_message_id: smsRecord?.id || null })
            .eq("id", msg.id);

          return "sent" as const;
        } catch (err) {
          console.error(`Failed to send message ${msg.id}:`, err);
          await supabaseAdmin
            .from("scheduled_messages")
            .update({ status: "failed" })
            .eq("id", msg.id);
          return "failed" as const;
        }
      });

      if (outcome === "sent") sent++;
      else failed++;
    }

    return { processed: dueMessages.length, sent, failed };
  },
);
