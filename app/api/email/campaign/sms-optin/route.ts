// POST /api/email/campaign/sms-optin
// Sends SMS opt-in invite emails to customers who haven't opted in and haven't
// received this email before. Works for both manual (admin cookie) and cron (CRON_SECRET).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM } from "@/lib/email/resend";
import { smsOptinEmailHtml } from "@/lib/email/templates/sms-optin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

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

    // Eligible: has email, not opted into SMS, never received this email
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", businessId)
      .eq("sms_consent", false)
      .not("email", "is", null)
      .is("sms_optin_email_sent_at", null);

    const eligible = (customers || []).filter((c) => c.email);

    if (eligible.length === 0) {
      return NextResponse.json({ sent: 0, message: "No eligible customers" });
    }

    const resend = getResend();
    const sentIds: string[] = [];
    let failed = 0;

    for (let i = 0; i < eligible.length; i += 10) {
      const batch = eligible.slice(i, i + 10);
      await Promise.all(
        batch.map(async (c) => {
          try {
            const html = smsOptinEmailHtml({
              customerName: c.full_name || "Valued Customer",
              businessName,
              businessSlug,
              appUrl: APP_URL,
              emailNumber: 1,
              customerId: c.id,
              brandColor,
            });
            const { error } = await resend.emails.send({
              from: FROM,
              to: c.email!,
              subject: `Stay connected with ${businessName} — enable text updates`,
              html,
            });
            if (error) { failed++; } else { sentIds.push(c.id); }
          } catch { failed++; }
        })
      );
    }

    if (sentIds.length > 0) {
      await supabaseAdmin
        .from("customers")
        .update({ sms_optin_email_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }

    return NextResponse.json({ sent: sentIds.length, failed, total: eligible.length });
  } catch (err) {
    console.error("sms-optin campaign error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
