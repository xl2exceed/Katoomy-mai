// GET /api/public/offer-eligibility?offerId=<id>&phone=<phone>
// Checks whether a customer (identified by phone) can redeem a network offer.
// Returns { eligible: true } or { eligible: false, reason, businessName? }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offerId = searchParams.get("offerId") ?? "";
  const phone = (searchParams.get("phone") ?? "").replace(/\D/g, "");

  if (!offerId || !phone) {
    return NextResponse.json({ eligible: false, reason: "missing_params" });
  }

  // Fetch the offer
  const { data: offer } = await supabaseAdmin
    .from("network_offers")
    .select("id, business_id, active, expires_at")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer || !offer.active) {
    return NextResponse.json({ eligible: false, reason: "offer_not_found" });
  }
  if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
    return NextResponse.json({ eligible: false, reason: "offer_expired" });
  }

  // Check if already redeemed by this phone
  const { data: existing } = await supabaseAdmin
    .from("network_offer_redemptions")
    .select("id")
    .eq("offer_id", offerId)
    .eq("customer_phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ eligible: false, reason: "already_used" });
  }

  // Check if customer has an active membership discount with this business
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", offer.business_id)
    .eq("phone", phone)
    .maybeSingle();

  if (customer) {
    const { data: sub } = await supabaseAdmin
      .from("member_subscriptions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("business_id", offer.business_id)
      .eq("status", "active")
      .maybeSingle();

    if (sub) {
      const { data: biz } = await supabaseAdmin
        .from("businesses")
        .select("name, app_name")
        .eq("id", offer.business_id)
        .maybeSingle();

      return NextResponse.json({
        eligible: false,
        reason: "has_discount",
        businessName: biz?.app_name || biz?.name || "this business",
      });
    }
  }

  return NextResponse.json({ eligible: true });
}
