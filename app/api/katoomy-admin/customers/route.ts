// GET /api/katoomy-admin/customers?businessId=&q=&limit=50&offset=0
// Returns customers with device_type and app_installed from customer_devices.

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

  // Fetch device info for this page of customers
  const customerIds = (customersResult.data || []).map((c) => c.id);
  let deviceMap: Record<string, { device_type: string; app_installed: boolean; last_seen_at: string }> = {};

  if (customerIds.length > 0) {
    const { data: deviceData } = await supabaseAdmin
      .from("customer_devices")
      .select("customer_id, device_type, app_installed, last_seen_at")
      .in("customer_id", customerIds);

    for (const d of deviceData || []) {
      deviceMap[d.customer_id] = {
        device_type: d.device_type,
        app_installed: d.app_installed,
        last_seen_at: d.last_seen_at,
      };
    }
  }

  const customers = (customersResult.data || []).map((c) => ({
    ...c,
    device_type: deviceMap[c.id]?.device_type ?? null,
    app_installed: deviceMap[c.id]?.app_installed ?? null,
    last_seen_at: deviceMap[c.id]?.last_seen_at ?? null,
  }));

  return NextResponse.json({ customers, total: customersResult.count || 0 });
}
