// POST /api/cron/email-campaigns
// Daily cron: sends app-install and SMS opt-in emails to newly eligible customers
// across all businesses. Each customer only ever receives each email once.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET || "katoomy-cron-2026-1ZXCVBNM";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: businesses } = await supabaseAdmin
    .from("businesses")
    .select("id");

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ message: "No businesses found" });
  }

  const results: Record<string, { appInstall: unknown; smsOptin: unknown }> = {};

  for (const biz of businesses) {
    const [appRes, smsRes] = await Promise.all([
      fetch(`${APP_URL}/api/email/campaign/app-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
        body: JSON.stringify({ businessId: biz.id }),
      }).then((r) => r.json()).catch((e) => ({ error: String(e) })),

      fetch(`${APP_URL}/api/email/campaign/sms-optin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
        body: JSON.stringify({ businessId: biz.id }),
      }).then((r) => r.json()).catch((e) => ({ error: String(e) })),
    ]);

    if ((appRes.sent ?? 0) > 0 || (smsRes.sent ?? 0) > 0) {
      results[biz.id] = { appInstall: appRes, smsOptin: smsRes };
    }
  }

  return NextResponse.json({ ok: true, results });
}
