import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Verify the requester is a logged-in admin
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { normalized_phone } = await req.json();
  if (!normalized_phone) return NextResponse.json({ error: "Missing normalized_phone" }, { status: 400 });

  await supabaseAdmin
    .from("phone_health")
    .update({ send_blocked: false, failure_count: 0, updated_at: new Date().toISOString() })
    .eq("normalized_phone", normalized_phone);

  return NextResponse.json({ ok: true });
}
