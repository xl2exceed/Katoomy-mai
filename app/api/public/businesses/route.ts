// GET /api/public/businesses?slugs=slug1,slug2,...
// Returns basic public info for a list of business slugs.
// Used by the /hub page to render business tiles.
// No auth required — data is publicly visible on the customer portal anyway.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slugsParam = searchParams.get("slugs") ?? "";
  const slugs = slugsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 30);

  if (slugs.length === 0) return NextResponse.json([]);

  const { data } = await supabaseAdmin
    .from("businesses")
    .select("slug, name, app_name, logo_url, primary_color")
    .in("slug", slugs);

  return NextResponse.json(data ?? []);
}