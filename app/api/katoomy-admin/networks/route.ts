// GET  /api/katoomy-admin/networks         — all networks + unplaced businesses
// POST /api/katoomy-admin/networks { action:"place", businessId }
// POST /api/katoomy-admin/networks { action:"move",  businessId, targetNetworkId }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceBusiness, recalcCenter } from "@/lib/network/autoPlace";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_TOKEN = process.env.KATOOMY_ADMIN_TOKEN || "katoomy-internal-2026";
function authorize(req: NextRequest) {
  return req.headers.get("x-katoomy-token") === ADMIN_TOKEN;
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All networks with their members
  const { data: memberships } = await supabaseAdmin
    .from("business_network_memberships")
    .select("network_id, business_id, joined_at, businesses(id, name, slug, features), business_networks(id, created_at)")
    .order("joined_at", { ascending: true });

  // Group by network
  type Member = { id: string; name: string; slug: string; niche: string; joined_at: string };
  type Network = { id: string; created_at: string; members: Member[] };

  const networkMap = new Map<string, Network>();

  for (const row of memberships ?? []) {
    const net = Array.isArray(row.business_networks) ? row.business_networks[0] : row.business_networks;
    const biz = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    if (!net || !biz) continue;

    if (!networkMap.has(net.id)) {
      networkMap.set(net.id, { id: net.id, created_at: net.created_at, members: [] });
    }
    networkMap.get(net.id)!.members.push({
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      niche: (biz.features as { niche?: string } | null)?.niche ?? "unknown",
      joined_at: row.joined_at,
    });
  }

  // Sort networks by created_at
  const networks = Array.from(networkMap.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Unplaced businesses
  const { data: unplacedRows } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug, created_at, features")
    .eq("network_placed", false)
    .order("created_at", { ascending: true });

  const unplaced = (unplacedRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    created_at: b.created_at,
    niche: (b.features as { niche?: string } | null)?.niche ?? "unknown",
  }));

  return NextResponse.json({ networks, unplaced });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, businessId, targetNetworkId } = body;

  if (!action || !businessId) {
    return NextResponse.json({ error: "Missing action or businessId" }, { status: 400 });
  }

  // ── Place ────────────────────────────────────────────────────────────────
  if (action === "place") {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("features")
      .eq("id", businessId)
      .single();

    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const niche = (biz.features as { niche?: string } | null)?.niche ?? "barber";

    try {
      const networkId = await autoPlaceBusiness(businessId, niche);
      return NextResponse.json({ networkId });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Move ─────────────────────────────────────────────────────────────────
  if (action === "move") {
    if (!targetNetworkId) {
      return NextResponse.json({ error: "Missing targetNetworkId" }, { status: 400 });
    }

    // Get moving business niche
    const { data: movingBiz } = await supabaseAdmin
      .from("businesses")
      .select("features")
      .eq("id", businessId)
      .single();

    if (!movingBiz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const niche = (movingBiz.features as { niche?: string } | null)?.niche ?? "barber";

    // Check niche conflict in target network
    const { data: targetMembers } = await supabaseAdmin
      .from("business_network_memberships")
      .select("business_id, businesses(features)")
      .eq("network_id", targetNetworkId);

    const conflict = (targetMembers ?? []).some((m) => {
      const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
      return (biz?.features as { niche?: string } | null)?.niche === niche;
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Target network already has a ${niche} business` },
        { status: 409 },
      );
    }

    const existingMemberIds = (targetMembers ?? []).map((m) => m.business_id);

    // Remove from current network
    const { data: current } = await supabaseAdmin
      .from("business_network_memberships")
      .select("network_id")
      .eq("business_id", businessId)
      .maybeSingle();

    const oldNetworkId = current?.network_id;

    if (oldNetworkId) {
      await supabaseAdmin
        .from("business_network_memberships")
        .delete()
        .eq("business_id", businessId);

      // Mark all existing partnerships as removed
      await supabaseAdmin
        .from("network_partners")
        .update({ status: "removed" })
        .or(`business_a_id.eq.${businessId},business_b_id.eq.${businessId}`);

      await recalcCenter(oldNetworkId);
    }

    // Add to target network
    await supabaseAdmin
      .from("business_network_memberships")
      .insert({ network_id: targetNetworkId, business_id: businessId });

    // Create active partner rows with all existing members of target network
    for (const memberId of existingMemberIds) {
      const [aId, bId] =
        businessId < memberId ? [businessId, memberId] : [memberId, businessId];
      await supabaseAdmin.from("network_partners").upsert(
        { business_a_id: aId, business_b_id: bId, status: "active", initiated_by: businessId },
        { onConflict: "business_a_id,business_b_id" },
      );
    }

    await recalcCenter(targetNetworkId);

    // Ensure settings + placed flag
    await supabaseAdmin.from("network_settings").upsert(
      { business_id: businessId, enabled: true, onboarding_complete: true, auto_approve_partners: true, allow_katoomy_suggestions: true },
      { onConflict: "business_id" },
    );
    await supabaseAdmin.from("businesses").update({ network_placed: true }).eq("id", businessId);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
