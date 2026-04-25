// file: app/api/ai-help/route.ts
// AI Help Assistant endpoint with answer caching.
// On each request:
//   1. Normalize the question + portal (lowercase, strip punctuation)
//   2. Check the Supabase cache table for a matching answer
//   3. If found, return the cached answer and update usage stats
//   4. If not found, call OpenAI with portal-specific context, store the result, and return it

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_HELP_SYSTEM_PROMPT } from "@/lib/ai-help-knowledge";

export const runtime = "nodejs";

type Portal = "admin-desktop" | "admin-mobile" | "staff";

// Portal-specific context injected at the top of the system prompt
const PORTAL_CONTEXT: Record<Portal, string> = {
  "admin-desktop":
    "You are helping a BUSINESS OWNER using the ADMIN DESKTOP portal. " +
    "Give instructions using the left sidebar menu labels. All features are available here.",
  "admin-mobile":
    "You are helping a BUSINESS OWNER using the ADMIN MOBILE APP on their phone. " +
    "Give instructions using the mobile bottom menu. " +
    "Only mobile-available features are accessible here. " +
    "If they ask about a desktop-only feature (Campaigns, Rewards, Referrals, Memberships, " +
    "Payment Setup, Payment Settings, Payment Ledger, Availability & Hours, Branding, Settings, " +
    "AI Growth Hub, or Upgrade Plan), tell them clearly: " +
    "\"That feature is only available on the desktop version. Please open Katoomy on a computer to access it.\"",
  "staff":
    "You are helping a STAFF MEMBER using the STAFF PORTAL. " +
    "Staff members only have access to: Dashboard, Schedule, Services, Customers, " +
    "Take Payment, Revenue, QR Code, and Notifications. " +
    "They do NOT have access to admin settings, campaigns, billing, branding, or any business configuration. " +
    "If they ask about an admin-only feature, respond: " +
    "\"That feature is only available to the business owner in the Admin portal. " +
    "Please ask your business owner to make that change.\"",
};

// Normalize a question for cache key matching:
// lowercase, remove punctuation, collapse whitespace
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { question, portal = "admin-desktop" } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Please ask a question." }, { status: 400 });
    }

    const safePortal: Portal = (["admin-desktop", "admin-mobile", "staff"] as Portal[]).includes(portal)
      ? (portal as Portal)
      : "admin-desktop";

    const trimmedQuestion = question.trim().slice(0, 500); // cap length

    // Include portal in the cache key so each portal gets its own cached answers
    const normalized = `${safePortal}:${normalizeQuestion(trimmedQuestion)}`;

    const supabase = await createClient();

    // ── 1. Check cache ──────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from("ai_help_cache")
      .select("id, answer, use_count")
      .eq("normalized_question", normalized)
      .maybeSingle();

    if (cached) {
      // Update usage stats asynchronously (don't await so response is instant)
      supabase
        .from("ai_help_cache")
        .update({
          last_used_at: new Date().toISOString(),
          use_count: cached.use_count + 1,
        })
        .eq("id", cached.id)
        .then(() => {});

      return NextResponse.json({ answer: cached.answer, cached: true });
    }

    // ── 2. Call OpenAI ──────────────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured. Please add OPENAI_API_KEY to your environment." },
        { status: 503 }
      );
    }

    // Prepend portal-specific context to the base system prompt
    const systemPrompt = `${PORTAL_CONTEXT[safePortal]}\n\n${AI_HELP_SYSTEM_PROMPT}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: trimmedQuestion },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      return NextResponse.json(
        { error: "The AI service is temporarily unavailable. Please try again shortly." },
        { status: 502 }
      );
    }

    const openaiData = await openaiRes.json();
    const answer: string = openaiData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!answer) {
      return NextResponse.json({ error: "No answer was generated." }, { status: 500 });
    }

    // ── 3. Store in cache ───────────────────────────────────────────────────
    await supabase.from("ai_help_cache").insert({
      question: trimmedQuestion,
      normalized_question: normalized,
      answer,
    });

    return NextResponse.json({ answer, cached: false });
  } catch (err) {
    console.error("ai-help error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
