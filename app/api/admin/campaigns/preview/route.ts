// GET /api/admin/campaigns/preview?audienceType=...&config=...
// Returns the list of customers who would receive this campaign, without sending.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const businessId = business.id;
  const params = req.nextUrl.searchParams;
  const audienceType = params.get("audienceType") || "all";
  const config = JSON.parse(params.get("config") || "{}");

  const customers = await resolveAudience(businessId, audienceType, config);

  return NextResponse.json({
    count: customers.length,
    preview: customers.slice(0, 5).map(c => ({ name: c.full_name || "Guest", phone: maskPhone(c.phone) })),
  });
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? `(${d.slice(0, 3)}) ***-${d.slice(-4)}` : phone;
}

export async function resolveAudience(
  businessId: string,
  audienceType: string,
  config: Record<string, number>
): Promise<{ id: string; full_name: string | null; phone: string }[]> {
  const { data: allCustomers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, created_at, sms_marketing_consent, sms_consent")
    .eq("business_id", businessId)
    .not("phone", "is", null);

  // 10DLC compliance: only include customers who opted in to marketing messages.
  // Fall back to legacy sms_consent for customers who booked before the consent split.
  const customers = (allCustomers || []).filter(c =>
    c.phone?.trim() &&
    (c.sms_marketing_consent === true || (c.sms_marketing_consent === null && c.sms_consent === true))
  );

  if (audienceType === "all") return customers;

  if (audienceType === "at_risk") {
    const days = config.days_inactive ?? 30;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);

    const { data: recentBookings } = await supabaseAdmin
      .from("bookings")
      .select("customer_id, start_ts")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_ts", cutoff.toISOString());

    const recentIds = new Set((recentBookings || []).map(b => b.customer_id));

    // Must have at least one booking ever
    const { data: anyBookings } = await supabaseAdmin
      .from("bookings")
      .select("customer_id")
      .eq("business_id", businessId)
      .neq("status", "cancelled");

    const everBookedIds = new Set((anyBookings || []).map(b => b.customer_id));
    return customers.filter(c => everBookedIds.has(c.id) && !recentIds.has(c.id));
  }

  if (audienceType === "members") {
    const { data: subs } = await supabaseAdmin
      .from("member_subscriptions")
      .select("customer_id")
      .eq("business_id", businessId)
      .eq("status", "active");
    const memberIds = new Set((subs || []).map(s => s.customer_id));
    return customers.filter(c => memberIds.has(c.id));
  }

  if (audienceType === "new") {
    const days = config.days_new ?? 30;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    return customers.filter(c => new Date(c.created_at) >= cutoff);
  }

  if (audienceType === "top_spenders") {
    const topN = config.top_n ?? 20;
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("customer_id, total_price_cents, payment_status, status, deposit_amount_cents")
      .eq("business_id", businessId);

    const spendMap = new Map<string, number>();
    for (const b of bookings || []) {
      if (
        (b.status === "completed" && ["paid", "cash_paid"].includes(b.payment_status)) ||
        ((b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid")
      ) {
        const forfeited = (b.status === "cancelled" || b.status === "no_show") && b.payment_status === "deposit_paid";
        const amt = forfeited ? (b.deposit_amount_cents || 0) : (b.total_price_cents || 0);
        spendMap.set(b.customer_id, (spendMap.get(b.customer_id) || 0) + amt);
      }
    }

    return customers
      .filter(c => (spendMap.get(c.id) || 0) > 0)
      .sort((a, b) => (spendMap.get(b.id) || 0) - (spendMap.get(a.id) || 0))
      .slice(0, topN);
  }

  return customers;
}
