// app/api/customer-help/route.ts
// AI Help Assistant endpoint for the customer-facing app.
// Uses a separate cache key prefix ("customer:") so customer and admin
// caches are stored independently but in the same ai_help_cache table.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_CUSTOMER_HELP_SYSTEM_PROMPT } from "@/lib/ai-customer-help-knowledge";

/** Normalize a question for cache key lookup */
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Please ask a question." }, { status: 400 });
    }

    const normalized = "customer:" + normalizeQuestion(question);
    const supabase = await createClient();

    // ── 1. Check cache first ───────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from("ai_help_cache")
      .select("answer")
      .eq("question_normalized", normalized)
      .single();

    if (cached?.answer) {
      return NextResponse.json({ answer: cached.answer, cached: true });
    }

    // ── 2. Call OpenAI ─────────────────────────────────────────────────────────
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_CUSTOMER_HELP_SYSTEM_PROMPT },
          { role: "user", content: question.trim() },
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[customer-help] OpenAI error:", errText);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const openaiData = await openaiRes.json();
    const answer: string =
      openaiData.choices?.[0]?.message?.content?.trim() ||
      "I'm sorry, I wasn't able to find an answer to that. Please contact the business directly for help.";

    // ── 3. Save to cache ───────────────────────────────────────────────────────
    await supabase.from("ai_help_cache").insert({
      question_normalized: normalized,
      question_original: question.trim(),
      answer,
    });

    return NextResponse.json({ answer, cached: false });
  } catch (err) {
    console.error("[customer-help] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
