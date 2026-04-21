// GET /api/cron/smart-campaigns
// Daily cron — runs every morning at 8 AM.
// Processes all automated smart campaigns for every business:
//
//   1. Win-back #1  — 30 days inactive (friendly check-in)
//   2. Win-back #2  — 60 days inactive (10% discount offer)
//   3. Win-back #3  — 90 days inactive (last-chance offer)
//   4. Referral nudge — 3 days after completed appointment
//   5. Re-engagement — past personal visit interval + buffer days
//
// Appointment reminders (24h before) are handled separately by
// /api/notifications/send-reminders which runs hourly.
//
// Security: Requires Authorization: Bearer <CRON_SECRET> header.
// Set up on cronjobs.org to call this URL daily at 8 AM.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getFromNumber } from "@/lib/twilio";

// ─── Types ────────────────────────────────────────────────────

interface SmartCampaignSettings {
  business_id: string;
  winback_30_enabled: boolean;
  winback_30_template: string | null;
  winback_60_enabled: boolean;
  winback_60_template: string | null;
  winback_90_enabled: boolean;
  winback_90_template: string | null;
  referral_post_visit_enabled: boolean;
  referral_post_visit_days: number;
  referral_post_visit_template: string | null;
  reengage_enabled: boolean;
  reengage_fallback_days: number;
  reengage_buffer_days: number;
  reengage_template: string | null;
  reengage_fallback_template: string | null;
}

interface Business {
  id: string;
  name: string;
  slug: string;
}

interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
  last_visit_at: string | null;
  referral_code: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Send an SMS via Twilio and log it to auto_campaign_log.
 * Returns true on success, false on failure.
 */
async function sendAndLog(params: {
  twilioClient: ReturnType<typeof getTwilio>["client"];
  fromNumber: string;
  toPhone: string;
  message: string;
  businessId: string;
  customerId: string;
  campaignType: string;
}): Promise<boolean> {
  const { twilioClient, fromNumber, toPhone, message, businessId, customerId, campaignType } = params;

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toPhone,
    });

    await supabaseAdmin.from("auto_campaign_log").insert({
      business_id: businessId,
      customer_id: customerId,
      customer_phone: toPhone,
      campaign_type: campaignType,
      message_body: message,
      status: "sent",
    });

    return true;
  } catch (err) {
    console.error(`[smart-campaigns] Failed to send ${campaignType} to ${toPhone}:`, err);

    await supabaseAdmin.from("auto_campaign_log").insert({
      business_id: businessId,
      customer_id: customerId,
      customer_phone: toPhone,
      campaign_type: campaignType,
      message_body: message,
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}

/**
 * Check if a customer was already sent a specific campaign type
 * within the given cooldown window (in days).
 */
async function wasRecentlySent(
  businessId: string,
  customerId: string,
  campaignType: string,
  cooldownDays: number
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("auto_campaign_log")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("campaign_type", campaignType)
    .eq("status", "sent")
    .gt("sent_at", daysAgo(cooldownDays))
    .limit(1)
    .maybeSingle();

  return !!data;
}

// ─── Campaign Processors ──────────────────────────────────────

/**
 * Win-back campaigns: 30 / 60 / 90 day tiers.
 * Each tier fires once per customer per tier (90-day cooldown per tier).
 * A customer who hit the 30-day tier will still get the 60-day tier
 * 30 days later if they still haven't come back.
 */
async function processWinbacks(
  business: Business,
  settings: SmartCampaignSettings,
  twilioClient: ReturnType<typeof getTwilio>["client"],
  fromNumber: string,
  baseUrl: string
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0, failed = 0, skipped = 0;

  const bookingLink = `${baseUrl}/${business.slug}`;

  const tiers = [
    {
      days: 30,
      enabled: settings.winback_30_enabled,
      template: settings.winback_30_template ??
        "Hey {{customer_name}}! It's been a little while since we've seen you at {{business_name}}. We miss you! Tap here to book your next appointment: {{booking_link}}",
      type: "winback_30",
    },
    {
      days: 60,
      enabled: settings.winback_60_enabled,
      template: settings.winback_60_template ??
        "Hey {{customer_name}}, we haven't seen you in a while and we want to make it worth your while to come back. Use code COMEBACK for 10% off your next visit at {{business_name}}. Book here: {{booking_link}} — offer expires in 7 days!",
      type: "winback_60",
    },
    {
      days: 90,
      enabled: settings.winback_90_enabled,
      template: settings.winback_90_template ??
        "Hey {{customer_name}}, we'd love to have you back at {{business_name}}! It's been 3 months and we're offering you a special returning customer deal — mention this text when you book and we'll take care of you. Book here: {{booking_link}}",
      type: "winback_90",
    },
  ];

  for (const tier of tiers) {
    if (!tier.enabled) { skipped++; continue; }

    // Find customers whose last visit was exactly in the tier window
    // e.g. for 30-day tier: last_visit_at is between 30 and 59 days ago
    const nextTierDays = tier.days === 90 ? 999 : tier.days + 30;
    const windowStart = daysAgo(nextTierDays);
    const windowEnd = daysAgo(tier.days);

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, last_visit_at, sms_marketing_consent, sms_consent")
      .eq("business_id", business.id)
      .not("phone", "is", null)
      .not("last_visit_at", "is", null)
      .gt("last_visit_at", windowStart)
      .lte("last_visit_at", windowEnd);

    if (!customers?.length) continue;

    for (const customer of customers) {
      if (!customer.phone) { skipped++; continue; }

      const phone = normalizePhone(customer.phone);
      if (!phone) { skipped++; continue; }

      // 10DLC compliance: only send marketing messages to customers who opted in.
      // Fall back to legacy sms_consent for customers who booked before the consent split.
      const hasMarketingConsent = (customer as { sms_marketing_consent?: boolean | null; sms_consent?: boolean | null }).sms_marketing_consent
        ?? (customer as { sms_consent?: boolean | null }).sms_consent
        ?? false;
      if (!hasMarketingConsent) { skipped++; continue; }

      // Check cooldown: don't re-send same tier within 90 days
      const alreadySent = await wasRecentlySent(business.id, customer.id, tier.type, 90);
      if (alreadySent) { skipped++; continue; }

      const message = fillTemplate(tier.template, {
        customer_name: customer.full_name?.split(" ")[0] ?? "there",
        business_name: business.name,
        booking_link: bookingLink,
      });

      const ok = await sendAndLog({
        twilioClient,
        fromNumber,
        toPhone: phone,
        message,
        businessId: business.id,
        customerId: customer.id,
        campaignType: tier.type,
      });

      ok ? sent++ : failed++;
    }
  }

  return { sent, failed, skipped };
}

/**
 * Referral post-visit nudge.
 * Sent N days after a customer's completed appointment (default: 3 days).
 * Cooldown: 90 days (so we don't spam repeat visitors).
 */
async function processReferralNudges(
  business: Business,
  settings: SmartCampaignSettings,
  twilioClient: ReturnType<typeof getTwilio>["client"],
  fromNumber: string,
  baseUrl: string
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0, failed = 0, skipped = 0;

  if (!settings.referral_post_visit_enabled) return { sent, failed, skipped };

  const delayDays = settings.referral_post_visit_days ?? 3;
  const template = settings.referral_post_visit_template ??
    "Hey {{customer_name}}, hope you're loving your results from {{business_name}}! If you know someone who'd love our services, send them your referral link and you'll both get rewarded: {{referral_link}}";

  // Find customers whose last completed booking was exactly N days ago
  // Window: between delayDays and delayDays+1 days ago
  const windowStart = daysAgo(delayDays + 1);
  const windowEnd = daysAgo(delayDays);

  // Find bookings completed in the target window
  const { data: recentBookings } = await supabaseAdmin
    .from("bookings")
    .select("customer_id, customers!inner(id, full_name, phone, referral_code, sms_marketing_consent, sms_consent)")
    .eq("business_id", business.id)
    .eq("status", "completed")
    .gt("start_ts", windowStart)
    .lte("start_ts", windowEnd);

  if (!recentBookings?.length) return { sent, failed, skipped };

  // Deduplicate by customer (a customer might have multiple bookings that day)
  const seen = new Set<string>();

  for (const booking of recentBookings) {
    const cust = booking.customers as unknown as Customer;
    if (!cust?.id || seen.has(cust.id)) continue;
    seen.add(cust.id);

    if (!cust.phone) { skipped++; continue; }

    const phone = normalizePhone(cust.phone);
    if (!phone) { skipped++; continue; }

    // 10DLC compliance: only send marketing messages to customers who opted in.
    const hasMarketingConsent = (cust as unknown as { sms_marketing_consent?: boolean | null; sms_consent?: boolean | null }).sms_marketing_consent
      ?? (cust as unknown as { sms_consent?: boolean | null }).sms_consent
      ?? false;
    if (!hasMarketingConsent) { skipped++; continue; }

    // Cooldown: don't send referral nudge more than once per 90 days
    const alreadySent = await wasRecentlySent(business.id, cust.id, "referral_post_visit", 90);
    if (alreadySent) { skipped++; continue; }

    const referralLink = cust.referral_code
      ? `${baseUrl}/${business.slug}?ref=${cust.referral_code}`
      : `${baseUrl}/${business.slug}`;

    const message = fillTemplate(template, {
      customer_name: cust.full_name?.split(" ")[0] ?? "there",
      business_name: business.name,
      referral_link: referralLink,
      booking_link: `${baseUrl}/${business.slug}`,
    });

    const ok = await sendAndLog({
      twilioClient,
      fromNumber,
      toPhone: phone,
      message,
      businessId: business.id,
      customerId: cust.id,
      campaignType: "referral_post_visit",
    });

    ok ? sent++ : failed++;
  }

  return { sent, failed, skipped };
}

/**
 * Re-engagement nudge.
 * Fires when a customer has gone past their personal visit interval + buffer.
 * For customers with only 1 visit, uses the fallback days setting (default: 21).
 * Cooldown: 30 days (so we don't re-send too quickly if they still don't come back).
 */
async function processReengagement(
  business: Business,
  settings: SmartCampaignSettings,
  twilioClient: ReturnType<typeof getTwilio>["client"],
  fromNumber: string,
  baseUrl: string
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0, failed = 0, skipped = 0;

  if (!settings.reengage_enabled) return { sent, failed, skipped };

  const fallbackDays = settings.reengage_fallback_days ?? 21;
  const bufferDays = settings.reengage_buffer_days ?? 7;
  const template = settings.reengage_template ??
    "Hey {{customer_name}}! It's about that time — you're usually in to see us around now. Ready to book your next appointment at {{business_name}}? It only takes a minute: {{booking_link}}";
  const fallbackTemplate = settings.reengage_fallback_template ??
    "Hey {{customer_name}}! It's been about 3 weeks since your last visit at {{business_name}}. Whenever you're ready to come back, booking is quick and easy: {{booking_link}}";

  const bookingLink = `${baseUrl}/${business.slug}`;

  // Get all customers with at least 1 visit who haven't booked recently
  // We look at customers whose last_visit_at is older than fallback days
  // (we'll refine per-customer based on their personal interval)
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, last_visit_at, sms_marketing_consent, sms_consent")
    .eq("business_id", business.id)
    .not("phone", "is", null)
    .not("last_visit_at", "is", null)
    .lt("last_visit_at", daysAgo(fallbackDays - bufferDays)); // broad filter first

  if (!customers?.length) return { sent, failed, skipped };

  for (const customer of customers) {
    if (!customer.phone || !customer.last_visit_at) { skipped++; continue; }

    const phone = normalizePhone(customer.phone);
    if (!phone) { skipped++; continue; }

    // 10DLC compliance: only send marketing messages to customers who opted in.
    const hasMarketingConsent = (customer as { sms_marketing_consent?: boolean | null; sms_consent?: boolean | null }).sms_marketing_consent
      ?? (customer as { sms_consent?: boolean | null }).sms_consent
      ?? false;
    if (!hasMarketingConsent) { skipped++; continue; }

    // Cooldown: don't re-engage more than once per 30 days
    const alreadySent = await wasRecentlySent(business.id, customer.id, "reengage", 30);
    if (alreadySent) { skipped++; continue; }

    // Get this customer's booking history to compute personal interval
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("start_ts")
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .eq("status", "completed")
      .order("start_ts", { ascending: false })
      .limit(10);

    const daysSinceLast = Math.floor(
      (Date.now() - new Date(customer.last_visit_at).getTime()) / 86_400_000
    );

    let shouldSend = false;
    let usePersonalTemplate = false;

    if (!bookings || bookings.length < 2) {
      // Single-visit customer: use fallback days
      shouldSend = daysSinceLast >= fallbackDays;
      usePersonalTemplate = false;
    } else {
      // Multi-visit customer: compute average interval
      const timestamps = bookings.map((b) => new Date(b.start_ts).getTime()).sort((a, b) => b - a);
      let totalGap = 0;
      for (let i = 0; i < timestamps.length - 1; i++) {
        totalGap += (timestamps[i] - timestamps[i + 1]) / 86_400_000;
      }
      const avgInterval = Math.round(totalGap / (timestamps.length - 1));
      const nudgeThreshold = avgInterval + bufferDays;

      shouldSend = daysSinceLast >= nudgeThreshold;
      usePersonalTemplate = true;
    }

    if (!shouldSend) { skipped++; continue; }

    const chosenTemplate = usePersonalTemplate ? template : fallbackTemplate;
    const message = fillTemplate(chosenTemplate, {
      customer_name: customer.full_name?.split(" ")[0] ?? "there",
      business_name: business.name,
      booking_link: bookingLink,
    });

    const ok = await sendAndLog({
      twilioClient,
      fromNumber,
      toPhone: phone,
      message,
      businessId: business.id,
      customerId: customer.id,
      campaignType: "reengage",
    });

    ok ? sent++ : failed++;
  }

  return { sent, failed, skipped };
}

// ─── Main Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
  const { client: twilioClient, mode } = getTwilio();
  const fromNumber = getFromNumber(mode);

  // Load all businesses that have smart campaign settings
  // We do a LEFT JOIN approach: get all businesses, then get their settings
  const { data: allBusinesses } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .not("name", "is", null);

  if (!allBusinesses?.length) {
    return NextResponse.json({ message: "No businesses found", processed: 0 });
  }

  const results: Record<string, unknown> = {};
  let totalSent = 0;
  let totalFailed = 0;

  for (const business of allBusinesses) {
    // Load or auto-create smart campaign settings for this business
    let { data: settings } = await supabaseAdmin
      .from("ai_marketing_settings")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    // Auto-create settings row with all defaults if it doesn't exist
    if (!settings) {
      const { data: created } = await supabaseAdmin
        .from("ai_marketing_settings")
        .insert({ business_id: business.id })
        .select()
        .single();
      settings = created;
    }

    if (!settings) continue;

    const s = settings as SmartCampaignSettings;
    const bizResult: Record<string, unknown> = {};

    // Run win-back campaigns (30/60/90 day tiers)
    try {
      bizResult.winback = await processWinbacks(business, s, twilioClient, fromNumber, baseUrl);
      totalSent += (bizResult.winback as { sent: number }).sent;
      totalFailed += (bizResult.winback as { failed: number }).failed;
    } catch (err) {
      bizResult.winback = { error: String(err) };
      console.error(`[smart-campaigns] winback error for ${business.id}:`, err);
    }

    // Run referral post-visit nudges
    try {
      bizResult.referral = await processReferralNudges(business, s, twilioClient, fromNumber, baseUrl);
      totalSent += (bizResult.referral as { sent: number }).sent;
      totalFailed += (bizResult.referral as { failed: number }).failed;
    } catch (err) {
      bizResult.referral = { error: String(err) };
      console.error(`[smart-campaigns] referral error for ${business.id}:`, err);
    }

    // Run re-engagement nudges
    try {
      bizResult.reengage = await processReengagement(business, s, twilioClient, fromNumber, baseUrl);
      totalSent += (bizResult.reengage as { sent: number }).sent;
      totalFailed += (bizResult.reengage as { failed: number }).failed;
    } catch (err) {
      bizResult.reengage = { error: String(err) };
      console.error(`[smart-campaigns] reengage error for ${business.id}:`, err);
    }

    results[business.id] = bizResult;
  }

  console.log(`[smart-campaigns] Done. Sent: ${totalSent}, Failed: ${totalFailed}`);

  return NextResponse.json({
    success: true,
    processed: allBusinesses.length,
    totalSent,
    totalFailed,
    results,
  });
}
