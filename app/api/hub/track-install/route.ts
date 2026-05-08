// POST /api/hub/track-install
// Records a PWA install event from the Business Hub.
// Public — no auth required. Fires once per device via localStorage guard in the client.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VALID_TYPES = new Set(["ios", "ipad", "android", "desktop", "unknown"]);

export async function POST(req: NextRequest) {
  try {
    const { deviceType, referrerSlug, userAgent } = await req.json();

    await supabaseAdmin.from("hub_installs").insert({
      device_type: VALID_TYPES.has(deviceType) ? deviceType : "unknown",
      referrer_slug: referrerSlug || null,
      user_agent: userAgent || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
