// POST /api/katoomy-admin/verify
// Validates email+password against Supabase auth AND katoomy_admins table.
// Returns { ok: true, name, role } or { error: string }.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // Check katoomy_admins table first (service_role bypasses RLS)
    const { data: admin } = await supabaseAdmin
      .from("katoomy_admins")
      .select("name, role")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Validate password via Supabase auth sign-in
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (authError) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, name: admin.name, role: admin.role });
  } catch (err) {
    console.error("katoomy-admin verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
