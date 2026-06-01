// POST /api/network/claim-offer
// Called from the customer-info page after the customer is identified by phone.
// Persists the hub offer claim to DB so it shows in the customer's offers page
// and survives localStorage clearing for up to 15 days.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CLAIM_VALIDITY_DAYS = 15;

export async function POST(req: NextRequest) {
  try {
    const { offerId, customerId, businessId, via } = await req.json();

    if (!offerId || !customerId || !businessId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the offer is still valid before persisting
    const { data: offer } = await supabaseAdmin
      .from("network_offers")
      .select("id, active, expires_at, budget_cents, total_cost_cents")
      .eq("id", offerId)
      .maybeSingle();

    if (!offer?.active) return NextResponse.json({ ok: false, reason: "offer_inactive" });
    if (offer.expires_at && new Date(offer.expires_at) < new Date()) return NextResponse.json({ ok: false, reason: "offer_expired" });
    if (offer.budget_cents && offer.total_cost_cents >= offer.budget_cents) return NextResponse.json({ ok: false, reason: "budget_exhausted" });

    const expiresAt = new Date(Date.now() + CLAIM_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await supabaseAdmin
      .from("network_offer_claims")
      .select("id, status")
      .eq("offer_id", offerId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existing?.status === "redeemed") {
      return NextResponse.json({ ok: true, already_redeemed: true });
    }

    if (existing) {
      await supabaseAdmin
        .from("network_offer_claims")
        .update({ expires_at: expiresAt, via_business_id: via || null })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("network_offer_claims")
        .insert({
          offer_id: offerId,
          customer_id: customerId,
          business_id: businessId,
          via_business_id: via || null,
          expires_at: expiresAt,
          status: "active",
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[claim-offer]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
