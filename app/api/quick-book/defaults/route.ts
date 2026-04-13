// file: app/api/quick-book/defaults/route.ts
// GET  ?businessId=&phone=          — fetch quick book defaults for a customer
// POST body: { businessId, phone, defaults } — upsert quick book defaults

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const phone = searchParams.get("phone");

  if (!businessId || !phone) {
    return NextResponse.json({ error: "Missing businessId or phone" }, { status: 400 });
  }

  // Look up customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", phone.replace(/\D/g, ""))
    .single();

  if (!customer) {
    return NextResponse.json({ defaults: null });
  }

  // Fetch defaults with joined service, staff, and addon details
  const { data: defaults } = await supabaseAdmin
    .from("customer_quick_book_defaults")
    .select(`
      id,
      booking_time,
      booking_day_of_week,
      vehicle_type,
      vehicle_condition,
      addon_ids,
      service_id,
      staff_id,
      services (id, name, price_cents, duration_minutes, pricing_type),
      staff (id, full_name, display_name, role, photo_url)
    `)
    .eq("customer_id", customer.id)
    .eq("business_id", businessId)
    .single();

  if (!defaults) {
    return NextResponse.json({ defaults: null, customerId: customer.id });
  }

  // Fetch addon details if any addon_ids stored
  let addons: { id: string; name: string; price_cents: number; duration_minutes: number }[] = [];
  const addonIds: string[] = Array.isArray(defaults.addon_ids) ? defaults.addon_ids : [];
  if (addonIds.length > 0) {
    const { data: addonData } = await supabaseAdmin
      .from("service_addons")
      .select("id, name, price_cents, duration_minutes")
      .in("id", addonIds);
    addons = addonData || [];
  }

  return NextResponse.json({
    defaults: { ...defaults, addons },
    customerId: customer.id,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { businessId, phone, defaults } = body;

  if (!businessId || !phone || !defaults) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Look up customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", phone.replace(/\D/g, ""))
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("customer_quick_book_defaults")
    .upsert(
      {
        customer_id: customer.id,
        business_id: businessId,
        service_id: defaults.service_id,
        staff_id: defaults.staff_id || null,
        booking_time: defaults.booking_time,
        booking_day_of_week: defaults.booking_day_of_week,
        vehicle_type: defaults.vehicle_type || null,
        vehicle_condition: defaults.vehicle_condition || null,
        addon_ids: defaults.addon_ids || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id,business_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
