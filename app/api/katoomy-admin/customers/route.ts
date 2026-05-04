// GET /api/katoomy-admin/customers?businessId=&q=&limit=50&offset=0
// Returns customers with app_installed flag (has push subscription).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_TOKEN = process.env.KATOOMY_ADMIN_TOKEN || "katoomy-internal-2026";
function authorize(req: NextRequest) {
  return req.headers.get("x-katoomy-token") === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const businessId = searchParams.get("businessId");
  const q = searchParams.get("q")?.trim() || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  // Fetch customers first, then cross-reference push_subscriptions by customer_id
  // (NOT by business_id — the subscribe route stores business_id as null for many customers)
  let customerQuery = supabaseAdmin
    .from("customers")
    .select("id, full_name, phone, email, created_at, last_visit_at, sms_consent", { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) customerQuery = customerQuery.ilike("full_name", `%${q}%`);

  const customersResult = await customerQuery;

  if (customersResult.error) {
    return NextResponse.json({ error: customersResult.error.message }, { status: 500 });
  }

  // Check which of this page's customers have a push subscription
  const customerIds = (customersResult.data || []).map((c) => c.id);
  let installedIds = new Set<string>();

  if (customerIds.length > 0) {
    const { data: pushData } = await supabaseAdmin
      .from("push_subscriptions")
      .select("customer_id")
      .in("customer_id", customerIds)
      .eq("user_type", "customer")
      .not("customer_id", "is", null);

    installedIds = new Set((pushData || []).map((p: { customer_id: string }) => p.customer_id));
  }

  const customers = (customersResult.data || []).map((c) => ({
    ...c,
    app_installed: installedIds.has(c.id),
  }));

  return NextResponse.json({ customers, total: customersResult.count || 0 });
}
