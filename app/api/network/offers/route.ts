// GET /api/network/offers?businessId=
// POST /api/network/offers  { title, offer_type, amount, min_spend_cents, expires_at, budget_cents }
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
    .from("network_offers").select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offers: data || [] });
}

export async function POST(req: NextRequest) {
  const businessId = await getAuthedBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, offer_type, amount, min_spend_cents, expires_at, budget_cents } = await req.json();
  if (!title || !offer_type || !amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["dollar_off", "percent_off"].includes(offer_type)) {
    return NextResponse.json({ error: "Invalid offer_type" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("network_offers").insert({
    business_id: businessId, title, offer_type, amount,
    min_spend_cents: min_spend_cents || null,
    expires_at: expires_at || null,
    budget_cents: budget_cents || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offer: data });
}
