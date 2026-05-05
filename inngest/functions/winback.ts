import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getRouting } from "@/lib/twilio";
import { getSmsTemplate } from "@/lib/smsTemplates";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export const winback = inngest.createFunction(
  { id: "winback", name: "Win-back Campaigns", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    const businessIds = await step.run("fetch-enabled-businesses", async () => {
      const { data } = await supabaseAdmin
        .from("ai_marketing_settings")
        .select("business_id")
        .eq("winback_enabled", true);
      return (data ?? []).map((s: { business_id: string }) => s.business_id);
    });

    if (businessIds.length === 0) return { sent: 0, failed: 0, skipped: 0 };

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const businessId of businessIds) {
      const result = await step.run(`winback-business-${businessId}`, async () => {
        const { data: biz } = await supabaseAdmin
          .from("businesses")
          .select("name, slug")
          .eq("id", businessId)
          .single();

        const { data: settings } = await supabaseAdmin
          .from("ai_marketing_settings")
          .select("*")
          .eq("business_id", businessId)
          .single();

        if (!settings?.winback_enabled) return { sent: 0, failed: 0, skipped: 1 };

        const inactiveDays = settings.winback_inactive_days ?? 60;
        const cooldownDays = settings.winback_cooldown_days ?? 30;
        const template = settings.winback_template ?? (await getSmsTemplate(businessId, "winback"));
        const businessName = biz?.name ?? "";
        const businessSlug = biz?.slug ?? "";

        const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();
        const cooloff = new Date(Date.now() - cooldownDays * 86400000).toISOString();

        const { data: inactive } = await supabaseAdmin
          .from("customers")
          .select("id, full_name, phone")
          .eq("business_id", businessId)
          .not("phone", "is", null)
          .lt("last_visit_at", cutoff);

        if (!inactive?.length) return { sent: 0, failed: 0, skipped: 0 };

        const ids = inactive.map((c: { id: string }) => c.id);
        const { data: recent } = await supabaseAdmin
          .from("auto_campaign_log")
          .select("customer_id")
          .eq("business_id", businessId)
          .eq("campaign_type", "winback")
          .eq("status", "sent")
          .gt("sent_at", cooloff)
          .in("customer_id", ids);

        const recentSet = new Set((recent ?? []).map((r: { customer_id: string }) => r.customer_id));
        const targets = inactive.filter((c: { id: string }) => !recentSet.has(c.id));
        if (!targets.length) return { sent: 0, failed: 0, skipped: 0 };

        const { client: twilioClient, mode } = getTwilio();
        const routing = getRouting(mode);
        const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com"}/${businessSlug}`;

        let sent = 0;
        let failed = 0;

        for (const customer of targets) {
          if (!customer.phone) { failed++; continue; }

          const message = fillTemplate(template, {
            customer_name: customer.full_name?.split(" ")[0] ?? "there",
            business_name: businessName,
            booking_link: bookingLink,
          });

          try {
            await twilioClient.messages.create({ body: message, ...routing, to: customer.phone });
            await supabaseAdmin.from("auto_campaign_log").insert({
              business_id: businessId,
              customer_id: customer.id,
              customer_phone: customer.phone,
              campaign_type: "winback",
              message_body: message,
              status: "sent",
            });
            sent++;
          } catch (err) {
            console.error(`[winback] Failed for ${customer.phone}:`, err);
            await supabaseAdmin.from("auto_campaign_log").insert({
              business_id: businessId,
              customer_id: customer.id,
              customer_phone: customer.phone,
              campaign_type: "winback",
              message_body: message,
              status: "failed",
              error_message: String(err),
            });
            failed++;
          }
        }

        return { sent, failed, skipped: 0 };
      });

      totalSent += result.sent;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
    }

    return { sent: totalSent, failed: totalFailed, skipped: totalSkipped };
  },
);
