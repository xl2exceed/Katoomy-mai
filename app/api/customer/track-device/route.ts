// POST /api/customer/track-device
// Called from the customer dashboard on every visit.
// Upserts device type and PWA install status per customer.
// No Supabase auth required — customers use phone-only auth.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_DEVICE_TYPES = ["ios", "ipad", "android", "desktop", "unknown"] as const;

export async function POST(req: NextRequest) {
  try {
    const { customerId, businessId, deviceType, appInstalled } = await req.json();

    if (!customerId || !businessId) {
      return NextResponse.json({ error: "Missing customerId or businessId" }, { status: 400 });
    }

    const resolvedType = VALID_DEVICE_TYPES.includes(deviceType) ? deviceType : "unknown";
    const userAgent = req.headers.get("user-agent") ?? null;

    const { error } = await supabaseAdmin
      .from("customer_devices")
      .upsert(
        {
          customer_id: customerId,
          business_id: businessId,
          device_type: resolvedType,
          app_installed: !!appInstalled,
          user_agent: userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      );

    if (error) {
      console.error("track-device error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("track-device error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
