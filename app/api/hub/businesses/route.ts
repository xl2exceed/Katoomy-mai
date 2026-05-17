// GET /api/hub/businesses?phone=<phone>
// Returns the server-side business list for a hub account identified by phone.
// Called by the hub page on load to sync the Supabase hub with localStorage.

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
