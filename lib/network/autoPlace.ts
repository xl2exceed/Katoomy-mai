import { supabaseAdmin } from "@/lib/supabase/admin";

const PRIMARY_RADIUS_MILES = 5;
const FALLBACK_RADIUS_MILES = 10;
const MAX_NETWORK_SIZE = 9;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function recalcCenter(networkId: string): Promise<void> {
  const { data: members } = await supabaseAdmin
    .from("business_network_memberships")
    .select("businesses(lat, lng)")
    .eq("network_id", networkId);

  if (!members || members.length === 0) return;

  const geoMembers = members
    .map((m) => {
      const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
      return biz as { lat: number | null; lng: number | null } | null;
    })
    .filter((b): b is { lat: number; lng: number } => !!b?.lat && !!b?.lng);

  if (geoMembers.length === 0) return;

  const centerLat = geoMembers.reduce((s, b) => s + b.lat, 0) / geoMembers.length;
  const centerLng = geoMembers.reduce((s, b) => s + b.lng, 0) / geoMembers.length;

  await supabaseAdmin
    .from("business_networks")
    .update({ center_lat: centerLat, center_lng: centerLng })
    .eq("id", networkId);
}

export async function autoPlaceBusiness(
  businessId: string,
  niche: string,
  lat?: number | null,
  lng?: number | null,
): Promise<string> {
  type MemberRow = {
    business_id: string;
    businesses:
      | { features: Record<string, unknown> }
      | { features: Record<string, unknown> }[]
      | null;
  };
  type NetworkRow = {
    id: string;
    center_lat: number | null;
    center_lng: number | null;
    created_at: string;
    business_network_memberships: MemberRow[];
    _distance?: number;
  };

  const { data: networks } = await supabaseAdmin
    .from("business_networks")
    .select(
      "id, center_lat, center_lng, created_at, business_network_memberships(business_id, businesses(features))",
    )
    .order("created_at", { ascending: true });

  const rows = (networks ?? []) as NetworkRow[];

  const eligible: NetworkRow[] = [];
  for (const net of rows) {
    const members = net.business_network_memberships;
    if (members.length >= MAX_NETWORK_SIZE) continue;

    const hasNiche = members.some((m) => {
      const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
      return (biz?.features as { niche?: string } | null)?.niche === niche;
    });
    if (hasNiche) continue;

    if (lat && lng && net.center_lat && net.center_lng) {
      const dist = haversine(lat, lng, net.center_lat, net.center_lng);
      net._distance = dist;
      if (dist > FALLBACK_RADIUS_MILES) continue;
    }

    eligible.push(net);
  }

  // Prefer networks within primary radius; fall back to full eligible set
  const primary =
    lat && lng
      ? eligible.filter(
          (n) => !n.center_lat || !n.center_lng || (n._distance ?? 0) <= PRIMARY_RADIUS_MILES,
        )
      : eligible;

  const pool = primary.length > 0 ? primary : eligible;

  // Fewest members first; tie-break by oldest network
  pool.sort((a, b) => {
    const diff = a.business_network_memberships.length - b.business_network_memberships.length;
    if (diff !== 0) return diff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  let networkId: string;
  let existingMemberIds: string[];

  if (pool.length > 0) {
    const chosen = pool[0];
    networkId = chosen.id;
    existingMemberIds = chosen.business_network_memberships.map((m) => m.business_id);
  } else {
    const { data: newNet, error } = await supabaseAdmin
      .from("business_networks")
      .insert({ center_lat: lat ?? null, center_lng: lng ?? null })
      .select("id")
      .single();
    if (error || !newNet) throw new Error("Failed to create network: " + error?.message);
    networkId = newNet.id;
    existingMemberIds = [];
  }

  await supabaseAdmin
    .from("business_network_memberships")
    .insert({ network_id: networkId, business_id: businessId });

  await recalcCenter(networkId);

  for (const memberId of existingMemberIds) {
    // Canonical ordering: lower UUID first to satisfy the unique constraint
    const [aId, bId] =
      businessId < memberId ? [businessId, memberId] : [memberId, businessId];
    await supabaseAdmin.from("network_partners").upsert(
      {
        business_a_id: aId,
        business_b_id: bId,
        status: "active",
        initiated_by: businessId,
      },
      { onConflict: "business_a_id,business_b_id" },
    );
  }

  // Ensure network_settings exists and marks this business as active in the network
  await supabaseAdmin.from("network_settings").upsert(
    {
      business_id: businessId,
      enabled: true,
      onboarding_complete: true,
      auto_approve_partners: true,
      allow_katoomy_suggestions: true,
    },
    { onConflict: "business_id" },
  );

  return networkId;
}
