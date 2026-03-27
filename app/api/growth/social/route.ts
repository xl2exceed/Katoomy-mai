// GET  /api/growth/social           — list social posts (with status filter)
// POST /api/growth/social           — generate AI posts from analytics
// PATCH /api/growth/social          — approve / reject / schedule a post
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────
interface GeneratedPost {
  platform: string;
  title: string;
  content: string;
  hashtags: string;
}

// ── Helpers ────────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`([^`]*)`/g, "$1").trim();
}

function safeParseJson(raw: string): unknown {
  const stripped = stripMarkdown(raw);
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return null;
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
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are a social media expert for appointment-based businesses. " +
            "Generate engaging, platform-appropriate posts. " +
            "Return ONLY a raw JSON array — no markdown, no code fences. " +
            "Each element: { \"platform\": string, \"title\": string, \"content\": string, \"hashtags\": string }",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── GET ────────────────────────────────────────────────────────
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

  const status = req.nextUrl.searchParams.get("status");
  let query = supabaseAdmin
    .from("social_posts")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts ?? [] });
}

// ── POST — generate AI posts ───────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { platforms = ["instagram", "facebook"], context } = body as {
    platforms?: string[];
    context?: string;
  };

  // Fetch analytics for context
  const analyticsRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/analytics?period=month`,
    { headers: { Cookie: req.headers.get("cookie") ?? "" } }
  );
  const analytics = analyticsRes.ok ? await analyticsRes.json() : {};

  // Build prompt from analytics
  const slowDays = (analytics.bookingsByDayOfWeek as Array<{name: string; count: number}> ?? [])
    .sort((a, b) => a.count - b.count)
    .slice(0, 2)
    .map((d) => d.name)
    .join(" and ");

  const topService = (analytics.topServices as Array<{name: string}> ?? [])[0]?.name ?? "our services";

  const prompt = `
Generate ${platforms.length} social media posts for "${business.name}", an appointment-based business.

BUSINESS INSIGHTS:
- Slowest days: ${slowDays || "weekdays"}
- Most popular service: ${topService}
- Total bookings this month: ${(analytics.current as Record<string,unknown>)?.bookings ?? "N/A"}
- Revenue this month: $${analytics.current ? (((analytics.current as Record<string,unknown>).revenue as number) / 100).toFixed(0) : "N/A"}
${context ? `- Additional context: ${context}` : ""}

Create one post for each platform: ${platforms.join(", ")}.
Make posts engaging, specific to this business's data, and include a call-to-action to book an appointment.
Tailor tone and length to each platform (Instagram: visual/emoji-friendly, Facebook: conversational, Twitter/X: concise, LinkedIn: professional).
`;

  try {
    const raw = await callOpenAI(prompt);
    const parsed = safeParseJson(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("AI did not return an array of posts");
    }

    const postsToInsert = (parsed as GeneratedPost[]).map((p) => ({
      business_id: business.id,
      source: "ai_analytics" as const,
      generation_context: context ?? `Auto-generated from analytics. Slow days: ${slowDays}`,
      platform: p.platform ?? platforms[0],
      title: p.title ?? "",
      content: p.content ?? "",
      hashtags: p.hashtags ?? "",
      status: "pending_approval" as const,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from("social_posts")
      .insert(postsToInsert)
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ posts: inserted, generated: inserted?.length ?? 0 });
  } catch (err) {
    console.error("[social] Generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── PATCH — update post status ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const { postId, status, scheduledFor, content } = body as {
    postId: string;
    status?: string;
    scheduledFor?: string;
    content?: string;
  };

  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const allowed = ["draft", "pending_approval", "approved", "scheduled", "cancelled"];
  if (status && !allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (scheduledFor) {
    updates.scheduled_for = scheduledFor;
    updates.status = "scheduled";
  }
  if (content) updates.content = content;

  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .update(updates)
    .eq("id", postId)
    .eq("business_id", business.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
