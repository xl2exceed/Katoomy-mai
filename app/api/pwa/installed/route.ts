// POST /api/pwa/installed
// Records a PWA install event for a business.
// Called from InstallGate when the browser fires the `appinstalled` event
// or when the app first opens in standalone mode (iOS).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    const userAgent = req.headers.get("user-agent") ?? undefined;

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    await supabaseAdmin.from("pwa_installs").insert({
      business_id: business.id,
      user_agent: userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pwa/installed error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
