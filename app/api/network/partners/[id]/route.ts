// PATCH /api/network/partners/[id]  { action: "accept" | "reject" | "remove" }
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const businessId = await getAuthedBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json();
  const statusMap: Record<string, string> = {
    accept: "active",
    reject: "rejected",
    remove: "removed",
  };
  const newStatus = statusMap[action];
  if (!newStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("network_partners")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}
