// GET /api/network/partners?businessId=   — list partner relationships
// POST /api/network/partners  { targetBusinessId }  — send partner invite
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

  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabaseAdmin.from("network_partners")
      .select("id, status, initiated_by, created_at, updated_at, business_b_id, businesses!network_partners_business_b_id_fkey(id, name, slug)")
      .eq("business_a_id", businessId).neq("status", "removed"),
    supabaseAdmin.from("network_partners")
      .select("id, status, initiated_by, created_at, updated_at, business_a_id, businesses!network_partners_business_a_id_fkey(id, name, slug)")
      .eq("business_b_id", businessId).neq("status", "removed"),
  ]);

  type BizRef = { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;

  const partners = [
    ...(asA || []).map((p) => ({
      id: p.id, status: p.status, initiated_by: p.initiated_by,
      created_at: p.created_at, my_side: "a" as const,
      partner: Array.isArray(p.businesses) ? (p.businesses as BizRef[])[0] : p.businesses as BizRef,
    })),
    ...(asB || []).map((p) => ({
      id: p.id, status: p.status, initiated_by: p.initiated_by,
      created_at: p.created_at, my_side: "b" as const,
      partner: Array.isArray(p.businesses) ? (p.businesses as BizRef[])[0] : p.businesses as BizRef,
    })),
  ];

  return NextResponse.json({ partners });
}

export async function POST(req: NextRequest) {
  const businessId = await getAuthedBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetBusinessId } = await req.json();
  if (!targetBusinessId) return NextResponse.json({ error: "Missing targetBusinessId" }, { status: 400 });
  if (targetBusinessId === businessId) return NextResponse.json({ error: "Cannot partner with yourself" }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("network_partners")
    .select("id, status")
    .or(`and(business_a_id.eq.${businessId},business_b_id.eq.${targetBusinessId}),and(business_a_id.eq.${targetBusinessId},business_b_id.eq.${businessId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") return NextResponse.json({ error: "Already partners" }, { status: 409 });
    if (existing.status === "pending") return NextResponse.json({ error: "Invite already sent or pending" }, { status: 409 });
  }

  const { data: targetSettings } = await supabaseAdmin.from("network_settings")
    .select("auto_approve_partners, enabled")
    .eq("business_id", targetBusinessId).maybeSingle();

  const autoApprove = targetSettings?.enabled && targetSettings?.auto_approve_partners;
  const status = autoApprove ? "active" : "pending";

  const { data, error } = await supabaseAdmin.from("network_partners").insert({
    business_a_id: businessId, business_b_id: targetBusinessId,
    initiated_by: businessId, status,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data, auto_approved: autoApprove });
}
