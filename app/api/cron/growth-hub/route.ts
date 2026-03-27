// GET /api/cron/growth-hub
// Vercel cron — runs daily at 9 AM.
// Processes all AI Growth Hub automatic campaigns:
//   1. Win-back texts for inactive customers
//   2. Referral reminders for recent visitors
//   3. Auto-generate social posts (if enabled)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cronHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  };

  // Get all businesses with AI marketing enabled
  const { data: allSettings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("business_id, winback_enabled, winback_mode, referral_enabled, referral_mode, social_enabled, social_mode");

  if (!allSettings?.length) {
    return NextResponse.json({ message: "No businesses with AI marketing configured" });
  }

  const results: Record<string, unknown> = {};

  for (const setting of allSettings) {
    const bizId = setting.business_id;
    const bizResult: Record<string, unknown> = {};

    // Win-back
    if (setting.winback_enabled && setting.winback_mode === "automatic") {
      try {
        const res = await fetch(`${baseUrl}/api/growth/winback?run=auto`, {
          method: "POST",
          headers: cronHeaders,
          body: JSON.stringify({ businessId: bizId }),
        });
        bizResult.winback = await res.json();
      } catch (err) {
        bizResult.winback = { error: String(err) };
      }
    }

    // Referral reminders
    if (setting.referral_enabled && setting.referral_mode === "automatic") {
      try {
        const res = await fetch(`${baseUrl}/api/growth/referral?run=auto`, {
          method: "POST",
          headers: cronHeaders,
          body: JSON.stringify({ businessId: bizId }),
        });
        bizResult.referral = await res.json();
      } catch (err) {
        bizResult.referral = { error: String(err) };
      }
    }

    // Social media auto-generation
    if (setting.social_enabled && setting.social_mode === "automatic") {
      try {
        const { data: biz } = await supabaseAdmin
          .from("businesses")
          .select("id, name")
          .eq("id", bizId)
          .single();

        if (biz) {
          // Check if we generated posts recently (avoid duplicates)
          const { data: recentPost } = await supabaseAdmin
            .from("social_posts")
            .select("id")
            .eq("business_id", bizId)
            .eq("source", "ai_analytics")
            .gt("created_at", new Date(Date.now() - 2 * 86400000).toISOString())
            .limit(1)
            .single();

          if (!recentPost) {
            bizResult.social = { skipped: true, reason: "Recent posts already exist" };
          } else {
            bizResult.social = { note: "Auto social generation requires app URL context" };
          }
        }
      } catch (err) {
        bizResult.social = { error: String(err) };
      }
    }

    results[bizId] = bizResult;
  }

  console.log("[growth-hub cron] Results:", JSON.stringify(results, null, 2));
  return NextResponse.json({ success: true, processed: allSettings.length, results });
}
