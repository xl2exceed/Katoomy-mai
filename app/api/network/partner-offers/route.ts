// GET /api/network/partner-offers?businessId=
// No auth — confirmation page uses this to show partner offers to customer post-booking
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  let businessId = req.nextUrl.searchParams.get("businessId");

  // Allow callers to pass slug instead of businessId
  if (!businessId) {
    const slug = req.nextUrl.searchParams.get("slug");
    if (slug) {
      const { data: biz } = await supabaseAdmin
        .from("businesses").select("id").eq("slug", slug).maybeSingle();
      businessId = biz?.id ?? null;
    }
  }

  if (!businessId) return NextResponse.json({ offers: [] });

  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabaseAdmin.from("network_partners").select("business_b_id").eq("business_a_id", businessId).eq("status", "active"),
    supabaseAdmin.from("network_partners").select("business_a_id").eq("business_b_id", businessId).eq("status", "active"),
  ]);

  const partnerIds = [
    ...(asA ?? []).map((p) => p.business_b_id),
    ...(asB ?? []).map((p) => p.business_a_id),
  ];

  if (partnerIds.length === 0) return NextResponse.json({ offers: [] });

  const now = new Date().toISOString();

  const { data: rawOffers } = await supabaseAdmin
    .from("network_offers")
    .select("id, business_id, title, offer_type, amount, total_cost_cents, budget_cents")
    .in("business_id", partnerIds)
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(10);

  // Filter out over-budget, one offer per partner
  const seen = new Set<string>();
  const offers: typeof rawOffers = [];
  for (const o of rawOffers ?? []) {
    if (seen.has(o.business_id)) continue;
    if (o.budget_cents && o.total_cost_cents >= o.budget_cents) continue;
    seen.add(o.business_id);
    offers.push(o);
  }

  // Enrich with business name + slug
  if (offers.length === 0) return NextResponse.json({ offers: [] });
  const ids = offers.map((o) => o.business_id);
  const { data: businesses } = await supabaseAdmin
    .from("businesses").select("id, name, slug").in("id", ids);

  const bizMap = Object.fromEntries((businesses ?? []).map((b) => [b.id, b]));

  const enriched = offers.map((o) => ({
    ...o,
    business_name: bizMap[o.business_id]?.name ?? "",
    business_slug: bizMap[o.business_id]?.slug ?? "",
  }));

  return NextResponse.json({ offers: enriched.slice(0, 5) });
}
