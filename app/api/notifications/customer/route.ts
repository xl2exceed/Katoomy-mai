// file: app/api/notifications/customer/route.ts
// Fetches and marks-read customer notifications using supabaseAdmin (bypasses RLS)
// Customers have no Supabase JWT session — they're identified by phone + slug only

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/notifications/customer?slug=X&phone=Y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const phone = searchParams.get("phone");

  if (!slug || !phone) {
    return NextResponse.json({ error: "Missing slug or phone" }, { status: 400 });
  }

  // Resolve business
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Resolve customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", biz.id)
    .eq("phone", phone)
    .single();

  if (!customer) {
    return NextResponse.json({ notifications: [] });
  }

  // Fetch notifications
  const { data: notifications, error } = await supabaseAdmin
    .from("notification_log")
    .select("id, created_at, title, body, url, read")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer notifications:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ notifications: notifications || [] });
}

// POST /api/notifications/customer — mark all as read
export async function POST(req: NextRequest) {
  const { slug, phone } = await req.json();

  if (!slug || !phone) {
    return NextResponse.json({ error: "Missing slug or phone" }, { status: 400 });
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", biz.id)
    .eq("phone", phone)
    .single();

  if (!customer) {
    return NextResponse.json({ success: true });
  }

  await supabaseAdmin
    .from("notification_log")
    .update({ read: true })
    .eq("customer_id", customer.id)
    .eq("read", false);

  return NextResponse.json({ success: true });
}
