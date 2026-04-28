// GET  /api/growth/winback          — list inactive customers eligible for win-back
// POST /api/growth/winback          — manually trigger win-back for selected customers
// POST /api/growth/winback?run=auto — called by cron to auto-send win-back texts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getFromNumber } from "@/lib/twilio";
import { getSmsTemplate } from "@/lib/smsTemplates";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// GET — list eligible inactive customers
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: settings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("winback_inactive_days, winback_cooldown_days")
    .eq("business_id", business.id)
    .single();

  const inactiveDays = settings?.winback_inactive_days ?? 60;
  const cooldownDays = settings?.winback_cooldown_days ?? 30;
  const cutoff = new Date(Date.now() - inactiveDays * 86400000).toISOString();
  const cooloffDate = new Date(Date.now() - cooldownDays * 86400000).toISOString();

  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, email, last_visit_at")
    .eq("business_id", business.id)
    .not("phone", "is", null)
    .lt("last_visit_at", cutoff)
    .order("last_visit_at", { ascending: true })
    .limit(100);

  if (!customers) return NextResponse.json({ customers: [], total: 0 });

  const customerIds = customers.map((c) => c.id);
  const { data: recentlySent } = await supabaseAdmin
    .from("auto_campaign_log")
    .select("customer_id")
    .eq("business_id", business.id)
    .eq("campaign_type", "winback")
    .eq("status", "sent")
    .gt("sent_at", cooloffDate)
    .in("customer_id", customerIds);

  const recentIds = new Set((recentlySent ?? []).map((r) => r.customer_id));
  const eligible = customers.filter((c) => !recentIds.has(c.id));

  return NextResponse.json({ customers: eligible, total: eligible.length, inactiveDays });
}

async function runWinbackForBusiness(businessId: string): Promise<{ sent: number; failed: number; skipped: number }> {
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
  const template = settings.winback_template ?? await getSmsTemplate(businessId, "winback");
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

  const ids = inactive.map((c) => c.id);
  const { data: recent } = await supabaseAdmin
    .from("auto_campaign_log")
    .select("customer_id")
    .eq("business_id", businessId)
    .eq("campaign_type", "winback")
    .eq("status", "sent")
    .gt("sent_at", cooloff)
    .in("customer_id", ids);

  const recentSet = new Set((recent ?? []).map((r) => r.customer_id));
  const targets = inactive.filter((c) => !recentSet.has(c.id));

  if (!targets.length) return { sent: 0, failed: 0, skipped: 0 };

  const { client: twilioClient } = getTwilio();
  const { mode } = getTwilio();
  const fromNumber = getFromNumber(mode);
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
      await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: customer.phone,
      });

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
      console.error(`[winback] Failed to send to ${customer.phone}:`, err);
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
}

// POST — send win-back texts
export async function POST(req: NextRequest) {
  const isAuto = req.nextUrl.searchParams.get("run") === "auto";

  if (isAuto) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { customerIds, businessId: bodyBusinessId } = body as {
    customerIds?: string[];
    businessId?: string;
  };

  // Auto mode — loop over all businesses if no specific businessId provided
  if (isAuto) {
    if (bodyBusinessId) {
      const result = await runWinbackForBusiness(bodyBusinessId);
      return NextResponse.json({ ...result, total: result.sent + result.failed });
    }

    // No businessId — run for all businesses with winback enabled
    const { data: allSettings } = await supabaseAdmin
      .from("ai_marketing_settings")
      .select("business_id")
      .eq("winback_enabled", true);

    if (!allSettings?.length) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

    const results = await Promise.all(
      allSettings.map((s) => runWinbackForBusiness(s.business_id))
    );

    const totals = results.reduce(
      (acc, r) => ({ sent: acc.sent + r.sent, failed: acc.failed + r.failed, skipped: acc.skipped + r.skipped }),
      { sent: 0, failed: 0, skipped: 0 }
    );

    return NextResponse.json({ ...totals, businesses: allSettings.length });
  }

  // Manual mode — derive business from session
  let businessId = bodyBusinessId;
  let businessName = "";
  let businessSlug = "";

  if (!businessId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug")
      .eq("owner_user_id", user.id)
      .single();
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });
    businessId = biz.id;
    businessName = biz.name;
    businessSlug = biz.slug;
  } else {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("name, slug")
      .eq("id", businessId)
      .single();
    businessName = biz?.name ?? "";
    businessSlug = biz?.slug ?? "";
  }

  if (!customerIds?.length) {
    return NextResponse.json({ error: "No customers selected" }, { status: 400 });
  }

  const { data: settings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("*")
    .eq("business_id", businessId)
    .single();

  const template = settings?.winback_template ?? await getSmsTemplate(businessId!, "winback");

  const { data: selected } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone")
    .eq("business_id", businessId)
    .in("id", customerIds);

  const targets = selected ?? [];
  if (!targets.length) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

  const { client: twilioClient } = getTwilio();
  const { mode } = getTwilio();
  const fromNumber = getFromNumber(mode);
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
      await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: customer.phone,
      });

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
      console.error(`[winback] Failed to send to ${customer.phone}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: targets.length });
}
