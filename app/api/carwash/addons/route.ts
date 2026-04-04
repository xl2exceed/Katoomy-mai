// file: app/api/carwash/addons/route.ts
// GET    /api/carwash/addons?businessId=...  — public read (for booking flow)
// POST   /api/carwash/addons                 — owner create/update addon
// DELETE /api/carwash/addons?id=...          — owner delete addon
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const activeOnly = req.nextUrl.searchParams.get("activeOnly") !== "false";

  let query = supabaseAdmin
    .from("service_addons")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const {
    id,
    name,
    description,
    price_cents,
    duration_minutes,
    active,
    sort_order,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (typeof price_cents !== "number" || price_cents < 0)
    return NextResponse.json({ error: "price_cents must be a non-negative number" }, { status: 400 });

  const payload = {
    business_id: business.id,
    name: name.trim(),
    description: description?.trim() || null,
    price_cents,
    duration_minutes: duration_minutes ?? 0,
    active: active !== false,
    sort_order: sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (id) {
    // Update existing
    const { data, error } = await supabaseAdmin
      .from("service_addons")
      .update(payload)
      .eq("id", id)
      .eq("business_id", business.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    // Create new
    const { data, error } = await supabaseAdmin
      .from("service_addons")
      .insert(payload)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("service_addons")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
