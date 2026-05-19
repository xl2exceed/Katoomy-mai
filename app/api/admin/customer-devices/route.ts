// GET /api/admin/customer-devices
// Returns device info for all customers belonging to the authed business.
// Uses supabaseAdmin to bypass the deny_all RLS policy on customer_devices.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("customer_devices")
    .select("customer_id, device_type, app_installed")
    .eq("business_id", business.id);

  const deviceMap: Record<string, { device_type: string | null; app_installed: boolean | null }> = {};
  for (const d of data || []) {
    deviceMap[d.customer_id] = { device_type: d.device_type, app_installed: d.app_installed };
  }

  return NextResponse.json({ deviceMap });
}
