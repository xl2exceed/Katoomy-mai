import { inngest, bookingCreatedEvent } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getResend, FROM } from "@/lib/email/resend";
import { appInstallEmailHtml, appInstallEmailSubject } from "@/lib/email/templates/app-install";
import { smsOptinEmailHtml, smsOptinEmailSubject } from "@/lib/email/templates/sms-optin";
import { getTwilio, getRouting } from "@/lib/twilio";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";

async function hasInstalledApp(customerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id")
    .eq("customer_id", customerId)
    .eq("user_type", "customer")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function hasSmsMarketingConsent(customerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("customers")
    .select("sms_marketing_consent")
    .eq("id", customerId)
    .maybeSingle();
  return !!data?.sms_marketing_consent;
}

async function alreadySent(
  businessId: string,
  customerId: string,
  campaignType: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("auto_campaign_log")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("campaign_type", campaignType)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function logCampaign(
  businessId: string,
  customerId: string,
  customerPhone: string,
  campaignType: string,
  messageBody: string,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string
) {
  await supabaseAdmin.from("auto_campaign_log").insert({
    business_id: businessId,
    customer_id: customerId,
    customer_phone: customerPhone,
    campaign_type: campaignType,
    message_body: messageBody,
    status,
    error_message: errorMessage ?? null,
  });
}

export const onboardingSequences = inngest.createFunction(
  { id: "onboarding-sequences", name: "Onboarding Sequences", retries: 2, triggers: [bookingCreatedEvent] },
  async ({ event, step }) => {
    const {
      customerId,
      businessId,
      businessSlug,
      businessName,
      customerName,
      customerEmail,
      customerPhone,
      hasSmsTransactional,
    } = event.data;

    const firstName = customerName?.split(" ")[0] ?? "there";

    // ── T+24h: SMS install nudge + SMS opt-in Email 1 ──────────────
    await step.sleep("wait-24h", "24 hours");

    if (hasSmsTransactional) {
      await step.run("sms-install-nudge", async () => {
        const campaignType = "app_install_sms";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasInstalledApp(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "", "skipped");
          return;
        }
        const bookingLink = `${APP_URL}/${businessSlug}`;
        const message = `Hi ${firstName}! Rebook ${businessName} faster with our app 📱 ${bookingLink} Reply STOP to opt out.`;
        try {
          const { client, mode } = getTwilio();
          const routing = getRouting(mode);
          const phone = customerPhone.startsWith("+") ? customerPhone : `+1${customerPhone}`;
          await client.messages.create({ body: message, ...routing, to: phone });
          await logCampaign(businessId, customerId, customerPhone, campaignType, message, "sent");
        } catch (err) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, message, "failed", String(err));
        }
      });
    }

    if (customerEmail) {
      await step.run("sms-optin-email-1", async () => {
        const campaignType = "sms_optin_email_1";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasSmsMarketingConsent(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "opted-in", "skipped");
          return;
        }
        const html = smsOptinEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 1, customerId });
        const subject = smsOptinEmailSubject(1, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }

    // ── T+2d: App Install Email 1 ──────────────────────────────────
    await step.sleep("wait-2d", "24 hours"); // 24h+24h = 2 days total

    if (customerEmail) {
      await step.run("install-email-1", async () => {
        const campaignType = "app_install_email_1";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasInstalledApp(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "already-installed", "skipped");
          return;
        }
        const html = appInstallEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 1 });
        const subject = appInstallEmailSubject(1, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }

    // ── T+5d: SMS Opt-In Email 2 ───────────────────────────────────
    await step.sleep("wait-5d", "3 days"); // +3 days = 5 days total

    if (customerEmail) {
      await step.run("sms-optin-email-2", async () => {
        const campaignType = "sms_optin_email_2";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasSmsMarketingConsent(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "opted-in", "skipped");
          return;
        }
        const html = smsOptinEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 2, customerId });
        const subject = smsOptinEmailSubject(2, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }

    // ── T+7d: App Install Email 2 ──────────────────────────────────
    await step.sleep("wait-7d", "2 days"); // +2 days = 7 days total

    if (customerEmail) {
      await step.run("install-email-2", async () => {
        const campaignType = "app_install_email_2";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasInstalledApp(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "already-installed", "skipped");
          return;
        }
        const html = appInstallEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 2 });
        const subject = appInstallEmailSubject(2, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }

    // ── T+14d: App Install Email 3 ─────────────────────────────────
    await step.sleep("wait-14d", "7 days"); // +7 days = 14 days total

    if (customerEmail) {
      await step.run("install-email-3", async () => {
        const campaignType = "app_install_email_3";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasInstalledApp(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "already-installed", "skipped");
          return;
        }
        const html = appInstallEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 3 });
        const subject = appInstallEmailSubject(3, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }

    // ── T+45d: SMS Opt-In Email 3 ──────────────────────────────────
    await step.sleep("wait-45d", "31 days"); // +31 days = 45 days total

    if (customerEmail) {
      await step.run("sms-optin-email-3", async () => {
        const campaignType = "sms_optin_email_3";
        if (await alreadySent(businessId, customerId, campaignType)) return;
        if (await hasSmsMarketingConsent(customerId)) {
          await logCampaign(businessId, customerId, customerPhone, campaignType, "opted-in", "skipped");
          return;
        }
        const html = smsOptinEmailHtml({ customerName: firstName, businessName, businessSlug, appUrl: APP_URL, emailNumber: 3, customerId });
        const subject = smsOptinEmailSubject(3, businessName);
        const resend = getResend();
        const { error } = await resend.emails.send({ from: FROM, to: customerEmail, subject, html });
        await logCampaign(businessId, customerId, customerPhone, campaignType, subject, error ? "failed" : "sent", error ? String(error) : undefined);
      });
    }
  }
);
