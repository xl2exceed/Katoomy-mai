// GET /api/admin/customers/search?q=<query>
// Returns customers for the authenticated business owner matching the search query.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, phone")
    .eq("business_id", business.id)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order("full_name", { ascending: true })
    .limit(20);

  return NextResponse.json({ customers: customers ?? [] });
}
