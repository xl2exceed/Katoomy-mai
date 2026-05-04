// GET /api/network/search?q=&excludeBusinessId=
// Returns businesses by name for partner invite search
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const excludeId = req.nextUrl.searchParams.get("excludeBusinessId");

  if (q.length < 2) return NextResponse.json({ businesses: [] });

  let query = supabaseAdmin
    .from("businesses").select("id, name, slug")
    .ilike("name", `%${q}%`).limit(10);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ businesses: data ?? [] });
}
