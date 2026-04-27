// GET  /api/growth/referral          — list customers eligible for referral reminder
// POST /api/growth/referral          — manually send referral reminders
// POST /api/growth/referral?run=auto — cron auto-send
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getFromNumber } from "@/lib/twilio";
import { getSmsTemplate } from "@/lib/smsTemplates";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: settings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("referral_delay_days, referral_cooldown_days")
    .eq("business_id", business.id)
    .single();

  const delayDays = settings?.referral_delay_days ?? 7;
  const cooldownDays = settings?.referral_cooldown_days ?? 90;

  const windowEnd = new Date(Date.now() - delayDays * 86400000).toISOString();
  const windowStart = new Date(Date.now() - (delayDays + 3) * 86400000).toISOString();
  const cooloff = new Date(Date.now() - cooldownDays * 86400000).toISOString();

  const { data: candidates } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, last_visit_at")
    .eq("business_id", business.id)
    .not("phone", "is", null)
    .gte("last_visit_at", windowStart)
    .lte("last_visit_at", windowEnd);

  if (!candidates?.length) return NextResponse.json({ customers: [], total: 0, delayDays });

  const ids = candidates.map((c) => c.id);
  const { data: recentLog } = await supabaseAdmin
    .from("referral_reminder_log")
    .select("customer_id")
    .eq("business_id", business.id)
    .gt("sent_at", cooloff)
    .in("customer_id", ids);

  const recentSet = new Set((recentLog ?? []).map((r) => r.customer_id));
  const eligible = candidates.filter((c) => !recentSet.has(c.id));

  return NextResponse.json({ customers: eligible, total: eligible.length, delayDays });
}

async function runReferralForBusiness(businessId: string): Promise<{ sent: number; failed: number; skipped: number }> {
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

  if (!settings?.referral_enabled) return { sent: 0, failed: 0, skipped: 1 };

  const delayDays = settings.referral_delay_days ?? 7;
  const cooldownDays = settings.referral_cooldown_days ?? 90;
  const template = settings.referral_template ?? await getSmsTemplate(businessId, "referral");
  const businessName = biz?.name ?? "";
  const businessSlug = biz?.slug ?? "";

  const windowEnd = new Date(Date.now() - delayDays * 86400000).toISOString();
  const windowStart = new Date(Date.now() - (delayDays + 3) * 86400000).toISOString();
  const cooloff = new Date(Date.now() - cooldownDays * 86400000).toISOString();

  const { data: candidates } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone")
    .eq("business_id", businessId)
    .not("phone", "is", null)
    .gte("last_visit_at", windowStart)
    .lte("last_visit_at", windowEnd);

  if (!candidates?.length) return { sent: 0, failed: 0, skipped: 0 };

  const ids = candidates.map((c) => c.id);
  const { data: recent } = await supabaseAdmin
    .from("referral_reminder_log")
    .select("customer_id")
    .eq("business_id", businessId)
    .gt("sent_at", cooloff)
    .in("customer_id", ids);

  const recentSet = new Set((recent ?? []).map((r) => r.customer_id));
  const targets = candidates.filter((c) => !recentSet.has(c.id));

  if (!targets.length) return { sent: 0, failed: 0, skipped: 0 };

  const { client: twilioClient } = getTwilio();
  const { mode } = getTwilio();
  const fromNumber = getFromNumber(mode);
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com"}/${businessSlug}/refer`;

  let sent = 0;
  let failed = 0;

  for (const customer of targets) {
    if (!customer.phone) { failed++; continue; }

    const message = fillTemplate(template, {
      customer_name: customer.full_name?.split(" ")[0] ?? "there",
      business_name: businessName,
      referral_link: referralLink,
    });

    try {
      await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: customer.phone,
      });

      await supabaseAdmin.from("referral_reminder_log").insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone,
        message_body: message,
        status: "sent",
      });

      sent++;
    } catch (err) {
      console.error(`[referral] Failed to send to ${customer.phone}:`, err);
      await supabaseAdmin.from("referral_reminder_log").insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone,
        message_body: message,
        status: "failed",
        error_message: String(err),
      });
      failed++;
    }
  }

  return { sent, failed, skipped: 0 };
}

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
      const result = await runReferralForBusiness(bodyBusinessId);
      return NextResponse.json({ ...result, total: result.sent + result.failed });
    }

    // No businessId — run for all businesses with referral enabled
    const { data: allSettings } = await supabaseAdmin
      .from("ai_marketing_settings")
      .select("business_id")
      .eq("referral_enabled", true);

    if (!allSettings?.length) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

    const results = await Promise.all(
      allSettings.map((s) => runReferralForBusiness(s.business_id))
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

  const template = settings?.referral_template ?? await getSmsTemplate(businessId!, "referral");
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com"}/${businessSlug}/refer`;

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

  let sent = 0;
  let failed = 0;

  for (const customer of targets) {
    if (!customer.phone) { failed++; continue; }

    const message = fillTemplate(template, {
      customer_name: customer.full_name?.split(" ")[0] ?? "there",
      business_name: businessName,
      referral_link: referralLink,
    });

    try {
      await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: customer.phone,
      });

      await supabaseAdmin.from("referral_reminder_log").insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone,
        message_body: message,
        status: "sent",
      });

      sent++;
    } catch (err) {
      console.error(`[referral] Failed to send to ${customer.phone}:`, err);
      await supabaseAdmin.from("referral_reminder_log").insert({
        business_id: businessId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone,
        message_body: message,
        status: "failed",
        error_message: String(err),
      });
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: targets.length });
}
