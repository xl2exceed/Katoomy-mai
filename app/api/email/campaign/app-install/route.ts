// POST /api/email/campaign/app-install
// Sends a 3-email sequence to customers who haven't installed the app:
//   Email 1 (Day 0):  app_install_email_sent_at IS NULL
//   Email 2 (Day 7):  email 1 sent 7+ days ago, email_2 not yet sent
//   Email 3 (Day 14): email 2 sent 7+ days ago, email_3 not yet sent
// Stops the sequence once the customer installs the app.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM } from "@/lib/email/resend";
import { appInstallEmailHtml } from "@/lib/email/templates/app-install";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";
const DAYS_7 = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "katoomy-cron-2026-1ZXCVBNM";
    const isCron = authHeader === `Bearer ${cronSecret}`;

    let businessId: string;
    let businessName: string;
    let businessSlug: string;
    let brandColor: string | undefined;

    if (isCron) {
      const body = await req.json().catch(() => ({}));
      if (!body.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
      const { data: biz } = await supabaseAdmin.from("businesses").select("id, name, slug, primary_color").eq("id", body.businessId).single();
      if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });
      businessId = biz.id; businessName = biz.name; businessSlug = biz.slug; brandColor = biz.primary_color ?? undefined;
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      await req.json().catch(() => {});
      const { data: biz } = await supabaseAdmin.from("businesses").select("id, name, slug, primary_color").eq("owner_user_id", user.id).maybeSingle();
      if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });
      businessId = biz.id; businessName = biz.name; businessSlug = biz.slug; brandColor = biz.primary_color ?? undefined;
    }

    const { data: campaignSettings } = await supabaseAdmin
      .from("ai_marketing_settings")
      .select("app_install_email_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (campaignSettings?.app_install_email_enabled === false) {
      return NextResponse.json({ sent: 0, message: "Campaign disabled for this business" });
    }

    // Get all customers who have installed the app (to exclude them from all tiers)
    const { data: devices } = await supabaseAdmin
      .from("customer_devices")
      .select("customer_id")
      .eq("business_id", businessId)
      .eq("app_installed", true);
    const installedIds = new Set((devices || []).map((d) => d.customer_id));

    const now = Date.now();
    const cutoff7 = new Date(now - DAYS_7).toISOString();

    // --- Tier 1: never received email 1 ---
    const { data: tier1Raw } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", businessId)
      .not("email", "is", null)
      .is("app_install_email_sent_at", null);

    // --- Tier 2: received email 1 7+ days ago, not yet sent email 2 ---
    const { data: tier2Raw } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", businessId)
      .not("email", "is", null)
      .not("app_install_email_sent_at", "is", null)
      .lte("app_install_email_sent_at", cutoff7)
      .is("app_install_email_2_sent_at", null);

    // --- Tier 3: received email 2 7+ days ago, not yet sent email 3 ---
    const { data: tier3Raw } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", businessId)
      .not("email", "is", null)
      .not("app_install_email_2_sent_at", "is", null)
      .lte("app_install_email_2_sent_at", cutoff7)
      .is("app_install_email_3_sent_at", null);

    const tier1 = (tier1Raw || []).filter((c) => c.email && !installedIds.has(c.id));
    const tier2 = (tier2Raw || []).filter((c) => c.email && !installedIds.has(c.id));
    const tier3 = (tier3Raw || []).filter((c) => c.email && !installedIds.has(c.id));

    const resend = getResend();
    const results = { email1: { sent: 0, failed: 0 }, email2: { sent: 0, failed: 0 }, email3: { sent: 0, failed: 0 } };

    async function sendTier(
      customers: { id: string; full_name: string | null; email: string | null }[],
      emailNumber: 1 | 2 | 3,
      subject: string,
      updateField: string,
      tier: keyof typeof results,
    ) {
      const sentIds: string[] = [];
      for (let i = 0; i < customers.length; i += 10) {
        const batch = customers.slice(i, i + 10);
        await Promise.all(
          batch.map(async (c) => {
            try {
              const html = appInstallEmailHtml({
                customerName: c.full_name || "Valued Customer",
                businessName,
                businessSlug,
                appUrl: APP_URL,
                emailNumber,
                brandColor,
              });
              const { error } = await resend.emails.send({
                from: FROM,
                to: c.email!,
                subject,
                html,
              });
              if (error) { results[tier].failed++; } else { sentIds.push(c.id); }
            } catch { results[tier].failed++; }
          })
        );
      }
      if (sentIds.length > 0) {
        await supabaseAdmin
          .from("customers")
          .update({ [updateField]: new Date().toISOString() })
          .in("id", sentIds);
        results[tier].sent = sentIds.length;
      }
    }

    await sendTier(
      tier1,
      1,
      `Get the ${businessName} app — book faster, earn rewards`,
      "app_install_email_sent_at",
      "email1",
    );
    await sendTier(
      tier2,
      2,
      `Still haven't tried the ${businessName} app? Here's why it's worth it`,
      "app_install_email_2_sent_at",
      "email2",
    );
    await sendTier(
      tier3,
      3,
      `Last chance — your ${businessName} app perks are waiting`,
      "app_install_email_3_sent_at",
      "email3",
    );

    const totalSent = results.email1.sent + results.email2.sent + results.email3.sent;
    const totalFailed = results.email1.failed + results.email2.failed + results.email3.failed;

    return NextResponse.json({
      sent: totalSent,
      failed: totalFailed,
      breakdown: results,
      totals: { tier1: tier1.length, tier2: tier2.length, tier3: tier3.length },
    });
  } catch (err) {
    console.error("app-install campaign error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
