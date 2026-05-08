// GET /api/admin/installs
// Returns hub PWA install stats and customer device breakdown for the Katoomy admin portal.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    // Verify admin session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Hub installs ──────────────────────────────────────────────────────────
    const { data: hubRows } = await supabaseAdmin
      .from("hub_installs")
      .select("id, installed_at, device_type, referrer_slug")
      .order("installed_at", { ascending: false });

    const rows = hubRows ?? [];

    // Total
    const total = rows.length;

    // By device
    const byDevice: Record<string, number> = { ios: 0, ipad: 0, android: 0, desktop: 0, unknown: 0 };
    for (const r of rows) {
      const dt = r.device_type as string;
      byDevice[dt] = (byDevice[dt] ?? 0) + 1;
    }

    // By referrer slug (sorted desc)
    const referrerMap = new Map<string, number>();
    for (const r of rows) {
      if (r.referrer_slug) {
        referrerMap.set(r.referrer_slug, (referrerMap.get(r.referrer_slug) ?? 0) + 1);
      }
    }
    const byReferrer = Array.from(referrerMap.entries())
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count);

    // Recent 20
    const recent = rows.slice(0, 20).map(r => ({
      id: r.id,
      installed_at: r.installed_at,
      device_type: r.device_type,
      referrer_slug: r.referrer_slug,
    }));

    // ── Customer devices ──────────────────────────────────────────────────────
    const { data: deviceRows } = await supabaseAdmin
      .from("customer_devices")
      .select("device_type, app_installed");

    const dRows = deviceRows ?? [];
    const customerTotal = dRows.length;
    const appInstalled = dRows.filter(d => d.app_installed).length;
    const customerByDevice: Record<string, number> = { ios: 0, ipad: 0, android: 0, desktop: 0, unknown: 0 };
    for (const d of dRows) {
      const dt = d.device_type as string;
      customerByDevice[dt] = (customerByDevice[dt] ?? 0) + 1;
    }

    return NextResponse.json({
      hub: { total, byDevice, byReferrer, recent },
      customers: { total: customerTotal, appInstalled, byDevice: customerByDevice },
    });
  } catch (err) {
    console.error("installs route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
