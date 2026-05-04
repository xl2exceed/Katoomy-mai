// GET /api/katoomy-admin/services?businessId=&dateFrom=&dateTo=

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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const [servicesResult, bookingsResult] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, name, price_cents, duration_minutes, active")
      .eq("business_id", businessId)
      .order("name"),

    (async () => {
      let q = supabaseAdmin
        .from("bookings")
        .select("service_id")
        .eq("business_id", businessId)
        .not("status", "eq", "cancelled");

      if (dateFrom) q = q.gte("start_ts", dateFrom);
      if (dateTo) q = q.lte("start_ts", dateTo + "T23:59:59Z");

      return q;
    })(),
  ]);

  const services = servicesResult.data || [];
  const bookings = bookingsResult.data || [];

  // Count bookings per service
  const countMap: Record<string, number> = {};
  for (const b of bookings) {
    if (b.service_id) countMap[b.service_id] = (countMap[b.service_id] || 0) + 1;
  }

  const result = services.map((s) => ({
    ...s,
    bookingCount: countMap[s.id] || 0,
  }));

  return NextResponse.json({ services: result });
}
