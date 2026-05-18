// GET  /api/hub/businesses?phone=<phone>  — returns server-side business list
// POST /api/hub/businesses               — adds a business by phone (called after booking)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
  }

  const { data: account } = await supabaseAdmin
    .from("hub_accounts")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ businesses: [] });
  }

  const { data: rows } = await supabaseAdmin
    .from("hub_businesses")
    .select("business_slug, biz_ref_id, net_ref_offer_id, net_ref_via")
    .eq("hub_account_id", account.id)
    .order("added_at", { ascending: true });

  return NextResponse.json({
    businesses: (rows ?? []).map((r) => ({
      slug: r.business_slug,
      bizRefId: r.biz_ref_id ?? null,
      netRefOfferId: r.net_ref_offer_id ?? null,
      netRefVia: r.net_ref_via ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { phone, businessSlug } = await req.json() as { phone: string; businessSlug: string };
  if (!phone || !businessSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("hub_accounts")
    .upsert({ phone }, { onConflict: "phone" })
    .select("id")
    .single();

  if (accountError || !account) {
    console.error("[hub/businesses POST] hub_account upsert failed:", accountError);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { error: bizError } = await supabaseAdmin
    .from("hub_businesses")
    .upsert(
      { hub_account_id: account.id, business_slug: businessSlug },
      { onConflict: "hub_account_id,business_slug" }
    );

  if (bizError) {
    console.error("[hub/businesses POST] hub_businesses upsert failed:", bizError);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
