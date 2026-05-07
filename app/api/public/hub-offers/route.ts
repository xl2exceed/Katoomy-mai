// GET /api/public/hub-offers?slugs=slug1,slug2,...
// Returns rotating offer cards for the hub page.
// Pulls membership plans and services — no auth required (public data).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface HubOffer {
  id: string;
  businessSlug: string;
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  type: "membership" | "service" | "default";
  title: string;
  body: string;
  ctaLabel: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slugsParam = searchParams.get("slugs") ?? "";
  const slugs = slugsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 30);

  if (slugs.length === 0) return NextResponse.json([]);

  const { data: businesses } = await supabaseAdmin
    .from("businesses")
    .select("id, slug, name, app_name, logo_url, primary_color")
    .in("slug", slugs);

  if (!businesses || businesses.length === 0) return NextResponse.json([]);

  const bizIds = businesses.map(b => b.id);
  const bizById: Record<string, typeof businesses[0]> = {};
  for (const b of businesses) bizById[b.id] = b;

  const offers: HubOffer[] = [];
  const businessesWithOffers = new Set<string>();

  // ── Membership plans ──────────────────────────────────────────────────────
  const { data: plans } = await supabaseAdmin
    .from("membership_plans")
    .select("id, business_id, name, price_cents, discount_percent")
    .in("business_id", bizIds)
    .eq("is_active", true);

  for (const plan of (plans ?? [])) {
    const biz = bizById[plan.business_id];
    if (!biz) continue;
    businessesWithOffers.add(biz.id);
    const price = (plan.price_cents / 100).toFixed(0);
    offers.push({
      id: `membership-${plan.id}`,
      businessSlug: biz.slug,
      businessName: biz.app_name || biz.name,
      logoUrl: biz.logo_url,
      primaryColor: biz.primary_color || "#7C3AED",
      type: "membership",
      title: `${plan.discount_percent}% Off Every Visit`,
      body: `Join the ${plan.name} at ${biz.app_name || biz.name} — only $${price}/mo`,
      ctaLabel: "Join Now",
    });
  }

  // ── Services (up to 2 per business, cheapest first) ───────────────────────
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, business_id, name, price_cents, duration_minutes")
    .in("business_id", bizIds)
    .eq("active", true)
    .order("price_cents", { ascending: true });

  const svcCount: Record<string, number> = {};
  for (const svc of (services ?? [])) {
    const count = svcCount[svc.business_id] ?? 0;
    if (count >= 2) continue;
    svcCount[svc.business_id] = count + 1;
    const biz = bizById[svc.business_id];
    if (!biz) continue;
    businessesWithOffers.add(biz.id);
    const price = svc.price_cents > 0 ? `$${(svc.price_cents / 100).toFixed(0)}` : "Free";
    offers.push({
      id: `service-${svc.id}`,
      businessSlug: biz.slug,
      businessName: biz.app_name || biz.name,
      logoUrl: biz.logo_url,
      primaryColor: biz.primary_color || "#7C3AED",
      type: "service",
      title: svc.name,
      body: `${biz.app_name || biz.name} · ${price} · ${svc.duration_minutes} min`,
      ctaLabel: "Book Now",
    });
  }

  // ── Fallback: one "Book Now" card per business with no other offers ────────
  for (const biz of businesses) {
    if (!businessesWithOffers.has(biz.id)) {
      offers.push({
        id: `default-${biz.id}`,
        businessSlug: biz.slug,
        businessName: biz.app_name || biz.name,
        logoUrl: biz.logo_url,
        primaryColor: biz.primary_color || "#7C3AED",
        type: "default",
        title: `Book at ${biz.app_name || biz.name}`,
        body: "Now accepting appointments — book your spot today.",
        ctaLabel: "Book Now",
      });
    }
  }

  // Shuffle so the same business doesn't always lead
  for (let i = offers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [offers[i], offers[j]] = [offers[j], offers[i]];
  }

  return NextResponse.json(offers);
}
