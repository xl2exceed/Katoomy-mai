// GET /api/customer/broadcast-offers?customerId=xxx
// Returns active (sent, unredeemed, within 15-day window) network broadcast offers for a customer.
// Used by the customer dashboard to show pending deals and their discounts.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OFFER_VALIDITY_DAYS = 15;

const TEMPLATE_LABELS: Record<string, string> = {
  limited_offer: "Limited Offer",
  open_slot:     "Open Slots",
  seasonal:      "Seasonal Deal",
  milestone:     "Celebration",
  custom:        "Special Offer",
};

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Fetch log entries for this customer that are active
  const { data: logEntries } = await supabaseAdmin
    .from("network_broadcast_log")
    .select("id, broadcast_id, sending_business_id, auto_discount_cents, created_at")
    .eq("customer_id", customerId)
    .eq("status", "sent")
    .is("redeemed_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (!logEntries?.length) {
    return NextResponse.json({ offers: [] });
  }

  const broadcastIds    = [...new Set(logEntries.map((e) => e.broadcast_id))];
  const sendingBizIds   = [...new Set(logEntries.map((e) => e.sending_business_id))];

  // Fetch broadcast offer details
  const { data: broadcasts } = await supabaseAdmin
    .from("network_broadcasts")
    .select("id, offer_text, offer_discount_cents, template_key")
    .in("id", broadcastIds);

  // Fetch sending business names
  const { data: businesses } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug")
    .in("id", sendingBizIds);

  const broadcastMap = new Map((broadcasts ?? []).map((b) => [b.id, b]));
  const bizMap       = new Map((businesses ?? []).map((b) => [b.id, b]));

  const now = Date.now();

  const offers = logEntries
    .map((entry) => {
      const broadcast = broadcastMap.get(entry.broadcast_id);
      const biz       = bizMap.get(entry.sending_business_id);
      if (!broadcast || !biz) return null;

      const createdMs  = new Date(entry.created_at).getTime();
      const expiresMs  = createdMs + OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
      const daysLeft   = Math.max(0, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000)));

      const offerDiscountCents = broadcast.offer_discount_cents ?? 0;
      const autoDiscountCents  = entry.auto_discount_cents ?? 0;
      const totalDiscountCents = offerDiscountCents + autoDiscountCents;

      return {
        id:                      entry.id,
        sending_business_name:   biz.name,
        sending_business_slug:   biz.slug,
        offer_text:              broadcast.offer_text ?? "",
        template_label:          TEMPLATE_LABELS[broadcast.template_key] ?? "Special Offer",
        offer_discount_cents:    offerDiscountCents,
        auto_discount_cents:     autoDiscountCents,
        total_discount_cents:    totalDiscountCents,
        created_at:              entry.created_at,
        expires_at:              new Date(expiresMs).toISOString(),
        days_remaining:          daysLeft,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ offers });
}
