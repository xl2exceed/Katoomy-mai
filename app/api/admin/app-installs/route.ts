// GET /api/admin/app-installs
// Returns total PWA install count for the authenticated business.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count } = await supabaseAdmin
    .from("pwa_installs")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  return NextResponse.json({ count: count ?? 0 });
}
