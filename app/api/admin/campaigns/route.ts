// GET  /api/admin/campaigns        -- list campaigns for this business
// POST /api/admin/campaigns        -- create a new campaign (draft)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getBusinessId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getBusinessId(user.id);
  if (!businessId) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data: campaigns } = await supabaseAdmin
    .from("sms_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ campaigns: campaigns || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getBusinessId(user.id);
  if (!businessId) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { name, messageTemplate, audienceType, audienceConfig } = await req.json();
  if (!name || !messageTemplate || !audienceType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: campaign, error } = await supabaseAdmin
    .from("sms_campaigns")
    .insert({
      business_id: businessId,
      name,
      message_template: messageTemplate,
      audience_type: audienceType,
      audience_config: audienceConfig || {},
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ campaign });
}
