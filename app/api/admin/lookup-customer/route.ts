// POST /api/admin/lookup-customer
// Admin version of staff lookup -- cookie auth, gets business from owner_user_id.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone } = await req.json();
  if (!phone) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const businessId = business.id;
  const cleanPhone = phone.replace(/\D/g, "");

  // Determine platform fee (passed to customer or absorbed by business)
  const { data: cashSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", businessId)
    .maybeSingle();
  const platformFeeCents = cashSettings?.fee_mode === "business_absorbs" ? 0 : 100;

  // Load services for this business
  const { data: rawServices } = await supabaseAdmin
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");
  // Bake platform fee into displayed service prices
  const services = (rawServices || []).map(s => ({ ...s, price_cents: s.price_cents + platformFeeCents }));

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

  // Find most recent unpaid/deposit-paid booking, OR a custom-status booking awaiting payment
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, service_id, total_price_cents, deposit_amount_cents, payment_status, status, start_ts, services(name, price_cents)")
    .eq("business_id", businessId)
    .eq("customer_id", customer.id)
    .or("and(payment_status.in.(unpaid,deposit_paid),status.in.(completed,confirmed)),and(status.eq.custom,payment_status.eq.unpaid)")
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
  // Add platform fee to displayed amount due
  priceCents += platformFeeCents;

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
          isCustom: booking.status === "custom",  // flag so UI knows to use custom payment flow
        }
      : null,
    services: services || [],
  });
}
