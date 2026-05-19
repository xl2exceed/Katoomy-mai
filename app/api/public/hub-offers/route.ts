// GET /api/public/hub-offers?slugs=slug1,slug2,...
// Returns active network offers from the hub's saved businesses.
// No auth required — offer titles/amounts are publicly visible.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface HubOffer {
  id: string;
  businessSlug: string;
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  title: string;
  body: string;
  ctaLabel: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const allMode = searchParams.get("all") === "true";
  const slugsParam = searchParams.get("slugs") ?? "";
  const slugs = slugsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 30);

  if (!allMode && slugs.length === 0) return NextResponse.json([]);

  // Fetch active, non-expired network offers — all businesses in allMode, or just the given slugs
  let networkOffersQuery = supabaseAdmin
    .from("network_offers")
    .select("id, business_id, title, offer_type, amount, min_spend_cents, expires_at")
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (!allMode) {
    // Resolve slug → business IDs first
    const { data: bizFilter } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .in("slug", slugs);
    if (!bizFilter || bizFilter.length === 0) return NextResponse.json([]);
    networkOffersQuery = networkOffersQuery.in("business_id", bizFilter.map(b => b.id));
  }

  const { data: networkOffers } = await networkOffersQuery.limit(50);

  if (!networkOffers || networkOffers.length === 0) return NextResponse.json([]);

  // Look up business info for all offers
  const bizIds = [...new Set(networkOffers.map(o => o.business_id))];
  const { data: businesses } = await supabaseAdmin
    .from("businesses")
    .select("id, slug, name, app_name, logo_url, primary_color")
    .in("id", bizIds);

  if (!businesses || businesses.length === 0) return NextResponse.json([]);

  const bizById: Record<string, typeof businesses[0]> = {};
  for (const b of businesses) bizById[b.id] = b;

  const offers: HubOffer[] = (networkOffers ?? []).filter(o => bizById[o.business_id]).map(offer => {
    const biz = bizById[offer.business_id];
    const amountStr = offer.offer_type === "percent_off"
      ? `${offer.amount}% off`
      : `$${(offer.amount / 100).toFixed(2).replace(/\.00$/, "")} off`;
    const minSpend = offer.min_spend_cents
      ? ` on orders over $${(offer.min_spend_cents / 100).toFixed(0)}`
      : "";

    return {
      id: offer.id,
      businessSlug: biz.slug,
      businessName: biz.app_name || biz.name,
      logoUrl: biz.logo_url,
      primaryColor: biz.primary_color || "#7C3AED",
      title: offer.title,
      body: `Get ${amountStr}${minSpend} at ${biz.app_name || biz.name}`,
      ctaLabel: "Get Discount Now",
    };
  });

  // Shuffle for variety
  for (let i = offers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [offers[i], offers[j]] = [offers[j], offers[i]];
  }

  return NextResponse.json(offers);
}
