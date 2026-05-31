// GET /api/customer/broadcast-offer-detail?logEntryId=xxx
// Validates a broadcast log entry and returns discount amounts.
// Used by customer-info page to apply broadcast offer discounts at checkout.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OFFER_VALIDITY_DAYS = 15;

export async function GET(req: NextRequest) {
  const logEntryId = req.nextUrl.searchParams.get("logEntryId");
  if (!logEntryId) {
    return NextResponse.json({ valid: false, error: "logEntryId required" }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: log } = await supabaseAdmin
    .from("network_broadcast_log")
    .select("id, broadcast_id, sending_business_id, auto_discount_cents, status, redeemed_at, created_at")
    .eq("id", logEntryId)
    .eq("status", "sent")
    .is("redeemed_at", null)
    .gte("created_at", cutoff)
    .single();

  if (!log) {
    return NextResponse.json({ valid: false, reason: "expired_or_redeemed" });
  }

  const { data: broadcast } = await supabaseAdmin
    .from("network_broadcasts")
    .select("offer_discount_cents, offer_text")
    .eq("id", log.broadcast_id)
    .single();

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("slug, name")
    .eq("id", log.sending_business_id)
    .single();

  const offerDiscountCents = broadcast?.offer_discount_cents ?? 0;
  const autoDiscountCents  = log.auto_discount_cents ?? 0;

  return NextResponse.json({
    valid:               true,
    logEntryId:          log.id,
    offerDiscountCents,
    autoDiscountCents,
    totalDiscountCents:  offerDiscountCents + autoDiscountCents,
    offerText:           broadcast?.offer_text ?? "",
    sendingBusinessSlug: biz?.slug ?? "",
    sendingBusinessName: biz?.name ?? "",
  });
}
