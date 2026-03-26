// POST /api/staff/lookup-customer
// Looks up a customer by phone for the staff member's business.
// Returns: customer name, most recent unpaid booking, and all active services.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { staffId, phone } = await req.json();
  if (!staffId || !phone) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify caller is this staff member
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, business_id, user_id")
    .eq("id", staffId)
    .single();

  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  if (staff.user_id !== user.id) {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("id", staff.business_id)
      .maybeSingle();
    if (!biz) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const businessId = staff.business_id;

  // Load services for this business
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");

  // Look up customer by phone
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, full_name")
    .eq("business_id", businessId)
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ customerName: null, existingBooking: null, services: services || [] });
  }

  // Find most recent unpaid/deposit-paid booking
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, service_id, total_price_cents, deposit_amount_cents, payment_status, start_ts, services(name, price_cents)")
    .eq("business_id", businessId)
    .eq("customer_id", customer.id)
    .in("payment_status", ["unpaid", "deposit_paid"])
    .in("status", ["completed", "confirmed"])
    .order("start_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const serviceName = booking
    ? (Array.isArray(booking.services)
        ? (booking.services as { name: string }[])[0]?.name
        : (booking.services as { name: string } | null)?.name) ?? ""
    : "";

  let priceCents = booking?.total_price_cents ?? 0;
  let depositPaidCents = 0;
  if (booking?.payment_status === "deposit_paid") {
    const depositPaid = booking.deposit_amount_cents ?? 0;
    const svcPrice = (Array.isArray(booking.services)
      ? (booking.services as { price_cents: number }[])[0]?.price_cents
      : (booking.services as { price_cents: number } | null)?.price_cents) ?? booking.total_price_cents;
    const fullPrice = booking.total_price_cents > depositPaid ? booking.total_price_cents : svcPrice;
    priceCents = fullPrice - depositPaid;
    depositPaidCents = depositPaid;
  }

  return NextResponse.json({
    customerName: customer.full_name,
    existingBooking: booking
      ? {
          id: booking.id,
          serviceId: booking.service_id,
          serviceName,
          priceCents,
          depositPaidCents,
          date: booking.start_ts,
        }
      : null,
    services: services || [],
  });
}
