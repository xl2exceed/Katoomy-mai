// POST /api/hub/add
// Looks up a short hub code, then adds the business to the customer's
// server-side hub. Called by the /hub/add landing page when an iOS user
// clicks an SMS referral link.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lookupHubCode } from "@/lib/hubCode";

export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code: string };

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const payload = await lookupHubCode(code);
  if (!payload) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("name, app_name")
    .eq("slug", payload.businessSlug)
    .maybeSingle();

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("hub_accounts")
    .upsert({ phone: payload.phone }, { onConflict: "phone" })
    .select("id")
    .single();

  if (accountError || !account) {
    console.error("[hub/add] hub_account upsert failed:", accountError);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { error: bizError } = await supabaseAdmin
    .from("hub_businesses")
    .upsert(
      {
        hub_account_id: account.id,
        business_slug: payload.businessSlug,
        biz_ref_id: payload.bizRefId ?? null,
        net_ref_offer_id: payload.netRefOfferId ?? null,
        net_ref_via: payload.netRefVia ?? null,
      },
      { onConflict: "hub_account_id,business_slug" }
    );

  if (bizError) {
    console.error("[hub/add] hub_businesses upsert failed:", bizError);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    businessName: biz.app_name || biz.name,
  });
}
