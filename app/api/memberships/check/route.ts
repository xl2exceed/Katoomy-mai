// GET /api/memberships/check?businessId=X&phone=Y
// Returns the active member discount percent for a customer. Uses service role to bypass RLS.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const phone = searchParams.get("phone");

  if (!businessId || !phone) {
    return NextResponse.json({ discountPercent: 0 });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (!customer) return NextResponse.json({ discountPercent: 0 });

  // Two-step query — avoids PostgREST FK join issues with manually-created tables
  const { data: sub } = await supabaseAdmin
    .from("member_subscriptions")
    .select("plan_id")
    .eq("customer_id", customer.id)
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();

  if (!sub?.plan_id) return NextResponse.json({ discountPercent: 0 });

  const { data: plan } = await supabaseAdmin
    .from("membership_plans")
    .select("discount_percent")
    .eq("id", sub.plan_id)
    .single();

  return NextResponse.json({ discountPercent: plan?.discount_percent ?? 0 });
}
