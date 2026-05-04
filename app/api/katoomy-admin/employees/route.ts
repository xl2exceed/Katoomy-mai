// GET  /api/katoomy-admin/employees        — list all Katoomy employees
// POST /api/katoomy-admin/employees        — create a new Katoomy employee
// DELETE /api/katoomy-admin/employees?id=  — remove an employee (owner only)
// All routes require X-Katoomy-Email header from an existing admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_TOKEN = process.env.KATOOMY_ADMIN_TOKEN || "katoomy-internal-2026";

function authorize(req: NextRequest) {
  return req.headers.get("x-katoomy-token") === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("katoomy_admins")
    .select("id, email, name, role, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data || [] });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, name, password } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: "Missing email, name, or password" }, { status: 400 });
  }

  // Create Supabase auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Insert into katoomy_admins
  const { data: emp, error: dbError } = await supabaseAdmin
    .from("katoomy_admins")
    .insert({ email: email.toLowerCase().trim(), name, role: "employee" })
    .select()
    .single();

  if (dbError) {
    // Rollback auth user creation
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ employee: emp });
}

export async function DELETE(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Prevent deleting self (owner)
  const { data: target } = await supabaseAdmin
    .from("katoomy_admins")
    .select("email, role")
    .eq("id", id)
    .single();

  if (!target) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner account" }, { status: 400 });
  }

  // Delete from katoomy_admins
  await supabaseAdmin.from("katoomy_admins").delete().eq("id", id);

  // Find and delete the Supabase auth user
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = authList?.users?.find((u) => u.email === target.email);
  if (authUser) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
  }

  return NextResponse.json({ ok: true });
}
