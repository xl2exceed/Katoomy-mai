// GET  /api/growth/settings  — fetch settings (creates defaults if none)
// PUT  /api/growth/settings  — update settings
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  let { data: settings } = await supabaseAdmin
    .from("ai_marketing_settings")
    .select("*")
    .eq("business_id", business.id)
    .single();

  if (!settings) {
    const { data: created } = await supabaseAdmin
      .from("ai_marketing_settings")
      .insert({ business_id: business.id })
      .select()
      .single();
    settings = created;
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
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

  // Whitelist allowed fields to prevent injection
  const allowed = [
    "winback_enabled", "winback_mode", "winback_inactive_days",
    "winback_template", "winback_cooldown_days",
    "referral_enabled", "referral_mode", "referral_delay_days",
    "referral_template", "referral_cooldown_days",
    "social_enabled", "social_mode", "social_post_frequency_days",
    "social_default_platforms", "insights_enabled", "insights_refresh_hours",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("ai_marketing_settings")
    .update(updates)
    .eq("business_id", business.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
