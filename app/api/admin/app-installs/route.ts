// GET /api/admin/app-installs?period=week|month|custom&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns PWA install count for the authenticated business, optionally filtered by date range.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let query = supabaseAdmin
    .from("pwa_installs")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  const now = new Date();

  if (period === "week") {
    const from = new Date(now.getTime() - 7 * 86400000).toISOString();
    query = query.gte("installed_at", from);
  } else if (period === "month") {
    const from = new Date(now.getTime() - 30 * 86400000).toISOString();
    query = query.gte("installed_at", from);
  } else if (period === "custom" && startDate && endDate) {
    query = query
      .gte("installed_at", `${startDate}T00:00:00.000Z`)
      .lte("installed_at", `${endDate}T23:59:59.999Z`);
  }
  // No filter = all time

  const { count } = await query;

  return NextResponse.json({ count: count ?? 0 });
}
