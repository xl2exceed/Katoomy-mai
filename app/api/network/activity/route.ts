// GET /api/network/activity?businessId=
// Returns recent sent/received referral activity with customer and partner details.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  // Direct referrals (SMS sends via "Refer Customer" button)
  const [{ data: directSent }, { data: directReceived }] = await Promise.all([
    supabaseAdmin
      .from("network_direct_referrals")
      .select("id, customer_name, customer_phone, status, created_at, receiving_business_id")
      .eq("sending_business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("network_direct_referrals")
      .select("id, customer_name, customer_phone, status, created_at, sending_business_id")
      .eq("receiving_business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Offer-link referrals (passive bookings via net_ref link)
  const [{ data: offerSent }, { data: offerReceived }] = await Promise.all([
    supabaseAdmin
      .from("network_referrals")
      .select("id, status, created_at, receiving_business_id, customer_id, customers(full_name, phone)")
      .eq("referring_business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("network_referrals")
      .select("id, status, created_at, referring_business_id, customer_id, customers(full_name, phone)")
      .eq("receiving_business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Collect all partner business IDs we need to name-resolve
  const partnerIds = new Set<string>();
  directSent?.forEach((r) => r.receiving_business_id && partnerIds.add(r.receiving_business_id));
  directReceived?.forEach((r) => r.sending_business_id && partnerIds.add(r.sending_business_id));
  offerSent?.forEach((r) => r.receiving_business_id && partnerIds.add(r.receiving_business_id));
  offerReceived?.forEach((r) => r.referring_business_id && partnerIds.add(r.referring_business_id));

  let bizNames: Record<string, string> = {};
  if (partnerIds.size > 0) {
    const { data: bizRows } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .in("id", Array.from(partnerIds));
    bizRows?.forEach((b) => { bizNames[b.id] = b.name; });
  }

  type ActivityItem = {
    id: string;
    direction: "sent" | "received";
    type: "direct" | "offer";
    customer_name: string | null;
    customer_phone: string | null;
    partner_name: string;
    status: string;
    created_at: string;
  };

  const activity: ActivityItem[] = [];

  directSent?.forEach((r) => activity.push({
    id: r.id,
    direction: "sent",
    type: "direct",
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    partner_name: bizNames[r.receiving_business_id] ?? "Unknown",
    status: r.status,
    created_at: r.created_at,
  }));

  directReceived?.forEach((r) => activity.push({
    id: r.id,
    direction: "received",
    type: "direct",
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    partner_name: bizNames[r.sending_business_id] ?? "Unknown",
    status: r.status,
    created_at: r.created_at,
  }));

  offerSent?.forEach((r) => {
    const cust = r.customers as { full_name?: string; phone?: string } | null;
    activity.push({
      id: r.id,
      direction: "sent",
      type: "offer",
      customer_name: cust?.full_name ?? null,
      customer_phone: cust?.phone ?? null,
      partner_name: bizNames[r.receiving_business_id] ?? "Unknown",
      status: r.status,
      created_at: r.created_at,
    });
  });

  offerReceived?.forEach((r) => {
    const cust = r.customers as { full_name?: string; phone?: string } | null;
    activity.push({
      id: r.id,
      direction: "received",
      type: "offer",
      customer_name: cust?.full_name ?? null,
      customer_phone: cust?.phone ?? null,
      partner_name: bizNames[r.referring_business_id] ?? "Unknown",
      status: r.status,
      created_at: r.created_at,
    });
  });

  // Sort all by date desc
  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ activity });
}
