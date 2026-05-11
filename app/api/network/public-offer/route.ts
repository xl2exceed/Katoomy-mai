// GET /api/network/public-offer?offerId=&receivingBusinessId=
// No auth — customer-facing booking page uses this to show offer banner + discount
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offerId");
  const receivingBusinessId = req.nextUrl.searchParams.get("receivingBusinessId");

  if (!offerId || !receivingBusinessId) return NextResponse.json({ offer: null });

  const { data: offer } = await supabaseAdmin
    .from("network_offers")
    .select("id, business_id, title, offer_type, amount, min_spend_cents, expires_at, active, budget_cents, total_cost_cents")
    .eq("id", offerId).eq("active", true).maybeSingle();

  if (!offer) return NextResponse.json({ offer: null });
  if (offer.expires_at && new Date(offer.expires_at) < new Date()) return NextResponse.json({ offer: null });
  if (offer.budget_cents && offer.total_cost_cents >= offer.budget_cents) return NextResponse.json({ offer: null });

  // If the offer is from a different business, verify an active partnership exists.
  // If the customer is booking directly at the offering business (hub self-referral),
  // no partnership check is needed.
  if (offer.business_id !== receivingBusinessId) {
    const { data: partnership } = await supabaseAdmin.from("network_partners")
      .select("id")
      .or(`and(business_a_id.eq.${offer.business_id},business_b_id.eq.${receivingBusinessId}),and(business_a_id.eq.${receivingBusinessId},business_b_id.eq.${offer.business_id})`)
      .eq("status", "active").maybeSingle();

    if (!partnership) return NextResponse.json({ offer: null });
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses").select("name").eq("id", offer.business_id).maybeSingle();

  return NextResponse.json({
    offer: { ...offer, referring_business_name: biz?.name ?? "" },
  });
}
