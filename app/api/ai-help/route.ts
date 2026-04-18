// file: app/api/ai-help/route.ts
// AI Help Assistant endpoint with answer caching.
// On each request:
//   1. Normalize the question (lowercase, strip punctuation)
//   2. Check the Supabase cache table for a matching answer
//   3. If found, return the cached answer and update usage stats
//   4. If not found, call OpenAI, store the result, and return it

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_HELP_SYSTEM_PROMPT } from "@/lib/ai-help-knowledge";

export const runtime = "nodejs";

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
    const { question } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Please ask a question." }, { status: 400 });
    }

    const trimmedQuestion = question.trim().slice(0, 500); // cap length
    const normalized = normalizeQuestion(trimmedQuestion);

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

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_HELP_SYSTEM_PROMPT },
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
