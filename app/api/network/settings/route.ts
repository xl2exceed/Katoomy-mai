// GET /api/network/settings?businessId=
// PATCH /api/network/settings  body: partial NetworkSettings
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthedBusinessId(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: biz } = await supabaseAdmin
    .from("businesses").select("id").eq("owner_user_id", user.id).maybeSingle();
  return biz?.id ?? null;
}

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("network_settings").select("*").eq("business_id", businessId).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  const businessId = await getAuthedBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    "enabled", "auto_approve_partners", "allow_katoomy_suggestions",
    "max_monthly_spend_cents", "referral_reward_cents", "onboarding_complete",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { data, error } = await supabaseAdmin
    .from("network_settings")
    .upsert({ business_id: businessId, ...patch }, { onConflict: "business_id" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
