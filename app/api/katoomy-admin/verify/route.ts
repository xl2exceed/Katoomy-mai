// POST /api/katoomy-admin/verify
// Validates email+password: checks katoomy_admins table then Supabase auth.
// Returns { ok: true, name, role } or { error: string }.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Must be in katoomy_admins (service_role bypasses RLS)
    const { data: admin } = await supabaseAdmin
      .from("katoomy_admins")
      .select("name, role")
      .eq("email", normalizedEmail)
      .single();

    if (!admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Validate password via Supabase auth
    const { error: authError } = await supabaseAnon.auth.signInWithPassword({ email: normalizedEmail, password });
    if (authError) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, name: admin.name, role: admin.role });
  } catch (err) {
    console.error("katoomy-admin verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
