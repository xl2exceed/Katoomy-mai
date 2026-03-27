// GET /api/growth/insights
// Returns AI-generated business insights based on analytics data.
// Caches results in ai_insights table per insights_refresh_hours setting.
// POST /api/growth/insights  { force: true }  — force-refresh the cache.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────
interface AiInsight {
  id: string;
  category: "revenue" | "bookings" | "customers" | "marketing" | "operations";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  metricLabel?: string;
  metricValue?: string;
}

interface InsightsResponse {
  insights: AiInsight[];
  summary: string;
  periodLabel: string;
  generatedAt: string;
  cached: boolean;
}

// ── Helpers ────────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
}

function safeParseJson(raw: string): unknown {
  const stripped = stripMarkdown(raw);
  // Try direct parse first
  try {
    return JSON.parse(stripped);
  } catch {
    // Extract first JSON object/array
    const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeInsight(raw: unknown): AiInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const categories = ["revenue", "bookings", "customers", "marketing", "operations"];
  const priorities = ["high", "medium", "low"];
  return {
    id: String(r.id || Math.random().toString(36).slice(2)),
    category: categories.includes(String(r.category)) ? (r.category as AiInsight["category"]) : "operations",
    priority: priorities.includes(String(r.priority)) ? (r.priority as AiInsight["priority"]) : "medium",
    title: String(r.title || "Insight"),
    description: String(r.description || ""),
    action: String(r.action || ""),
    metricLabel: r.metricLabel ? String(r.metricLabel) : undefined,
    metricValue: r.metricValue !== undefined && r.metricValue !== null
      ? (typeof r.metricValue === "object" ? JSON.stringify(r.metricValue) : String(r.metricValue))
      : undefined,
  };
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an expert business analyst for appointment-based businesses (salons, barbershops, spas, etc.). " +
            "Analyze the provided analytics data and return ONLY a raw JSON object — no markdown, no code fences, no explanation. " +
            "Return exactly this structure: { \"summary\": \"string\", \"insights\": [ { \"id\": \"string\", \"category\": \"revenue|bookings|customers|marketing|operations\", \"priority\": \"high|medium|low\", \"title\": \"string\", \"description\": \"string\", \"action\": \"string\", \"metricLabel\": \"string or null\", \"metricValue\": \"string or null\" } ] }",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateInsights(
  businessId: string,
  analyticsData: Record<string, unknown>,
  settings: Record<string, unknown>
): Promise<{ insights: AiInsight[]; summary: string }> {
  const prompt = `
Analyze this appointment business data and provide 5-8 actionable insights.

BUSINESS ANALYTICS (Last 30 Days):
- Total bookings: ${analyticsData.current ? (analyticsData.current as Record<string,unknown>).bookings : "N/A"}
- Revenue: $${analyticsData.current ? (((analyticsData.current as Record<string,unknown>).revenue as number) / 100).toFixed(2) : "N/A"}
- New customers: ${analyticsData.newVsReturning ? (analyticsData.newVsReturning as Record<string,unknown>).newCount : "N/A"}
- Returning customers: ${analyticsData.newVsReturning ? (analyticsData.newVsReturning as Record<string,unknown>).returningCount : "N/A"}
- Rebooking rate: ${analyticsData.rebookingRate ?? "N/A"}%
- Avg ticket: $${analyticsData.avgTicketCents ? ((analyticsData.avgTicketCents as number) / 100).toFixed(2) : "N/A"}
- Avg days between visits: ${analyticsData.avgDaysBetweenVisits ?? "N/A"}
- At-risk customers (30+ days inactive): ${analyticsData.atRiskCustomers ? (analyticsData.atRiskCustomers as unknown[]).length : "N/A"}
- Total customers: ${analyticsData.totalCustomers ?? "N/A"}

BOOKINGS BY DAY OF WEEK:
${JSON.stringify(analyticsData.bookingsByDayOfWeek ?? [], null, 2)}

TOP SERVICES:
${JSON.stringify((analyticsData.topServices as unknown[] ?? []).slice(0, 5), null, 2)}

EXISTING ALERTS FROM SYSTEM:
${JSON.stringify(analyticsData.alerts ?? [], null, 2)}

CURRENT SETTINGS:
- Win-back texts: ${settings.winback_enabled ? "enabled" : "disabled"} (${settings.winback_inactive_days} day threshold)
- Referral reminders: ${settings.referral_enabled ? "enabled" : "disabled"}
- Social media posting: ${settings.social_enabled ? "enabled" : "disabled"}

Focus on: slow days, revenue opportunities, customer retention, and specific actionable recommendations.
Each insight should be specific to this business's data, not generic advice.
`;

  const raw = await callOpenAI(prompt);
  const parsed = safeParseJson(raw) as Record<string, unknown> | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Failed to parse AI response");
  }

  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  const insights = insightsRaw
    .map(sanitizeInsight)
    .filter((i): i is AiInsight => i !== null);

  return {
    insights,
    summary: typeof parsed.summary === "string" ? parsed.summary : "AI analysis complete.",
  };
}

// ── GET handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const businessId = business.id;
  const force = req.nextUrl.searchParams.get("force") === "true";

  // Get settings (create defaults if missing)
  let { data: settings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (!settings) {
    const { data: newSettings } = await supabaseAdmin
      .from("ai_marketing_settings")
      .insert({ business_id: businessId })
      .select()
      .single();
    settings = newSettings;
  }

  const refreshHours = settings?.insights_refresh_hours ?? 24;

  // Check cache
  if (!force) {
    const { data: cached } = await supabaseAdmin
      .from("ai_insights")
      .select("*")
      .eq("business_id", businessId)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return NextResponse.json({
        insights: cached.insights as AiInsight[],
        summary: cached.summary ?? "",
        periodLabel: cached.period_label ?? "Last 30 Days",
        generatedAt: cached.generated_at,
        cached: true,
      } satisfies InsightsResponse);
    }
  }

  // Fetch fresh analytics
  const analyticsRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/analytics?period=month`,
    {
      headers: {
        Cookie: req.headers.get("cookie") ?? "",
      },
    }
  );

  let analyticsData: Record<string, unknown> = {};
  if (analyticsRes.ok) {
    analyticsData = await analyticsRes.json();
  }

  // Generate AI insights
  try {
    const { insights, summary } = await generateInsights(
      businessId,
      analyticsData,
      settings ?? {}
    );

    const expiresAt = new Date(Date.now() + refreshHours * 60 * 60 * 1000).toISOString();

    // Delete old cached insights and save new ones
    await supabaseAdmin.from("ai_insights").delete().eq("business_id", businessId);
    await supabaseAdmin.from("ai_insights").insert({
      business_id: businessId,
      analytics_snapshot: analyticsData,
      insights,
      summary,
      period_label: "Last 30 Days",
      expires_at: expiresAt,
    });

    return NextResponse.json({
      insights,
      summary,
      periodLabel: "Last 30 Days",
      generatedAt: new Date().toISOString(),
      cached: false,
    } satisfies InsightsResponse);
  } catch (err) {
    console.error("[growth/insights] AI error:", err);
    return NextResponse.json(
      { error: "Failed to generate insights. Please check your OpenAI API key." },
      { status: 500 }
    );
  }
}

// POST — force refresh
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("force", "true");
  return GET(new NextRequest(url, { headers: req.headers }));
}
