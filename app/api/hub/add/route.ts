// POST /api/hub/add
// Validates a signed hub token, then adds the business to the customer's
// server-side hub. Called by the /hub/add landing page when an iOS user
// clicks an SMS referral link.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyHubToken } from "@/lib/hubToken";

export async function POST(req: NextRequest) {
  const { token, businessSlug, bizRefId, netRefOfferId, netRefVia } =
    await req.json() as {
      token: string;
      businessSlug: string;
      bizRefId?: string;
      netRefOfferId?: string;
      netRefVia?: string;
    };

  if (!token || !businessSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload = verifyHubToken(token);
  if (!payload) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("name, app_name")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Upsert hub_account keyed by phone — idempotent, safe to call multiple times
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
        business_slug: businessSlug,
        biz_ref_id: bizRefId ?? null,
        net_ref_offer_id: netRefOfferId ?? null,
        net_ref_via: netRefVia ?? null,
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
