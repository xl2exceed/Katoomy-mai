// GET /api/staff/qr-booking-info?bookingId=...&slug=...
// Public endpoint — returns the info needed for the pay-qr tip page.
// No auth required: the customer scanning the QR is not logged in.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  const slug = searchParams.get("slug");

  if (!bookingId || !slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, total_price_cents, deposit_amount_cents, payment_status, business_id, services(name), businesses(slug)")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.payment_status === "paid" || booking.payment_status === "cash_paid") {
    return NextResponse.json({ error: "This booking has already been paid." }, { status: 400 });
  }

  // Remaining balance for deposit-paid bookings
  const depositPaid = booking.deposit_amount_cents ?? 0;
  const baseServiceCents =
    booking.payment_status === "deposit_paid"
      ? (booking.total_price_cents > depositPaid ? booking.total_price_cents : booking.total_price_cents) - depositPaid
      : booking.total_price_cents;

  // Add platform fee if passed to customer
  const { data: cashSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", booking.business_id)
    .maybeSingle();
  const platformFee = cashSettings?.fee_mode === "business_absorbs" ? 0 : 100;
  const serviceCents = baseServiceCents + platformFee;

  const serviceName =
    (Array.isArray(booking.services)
      ? (booking.services as { name: string }[])[0]?.name
      : (booking.services as { name: string } | null)?.name) ?? "Service";

  return NextResponse.json({
    serviceName,
    serviceCents,
    businessId: booking.business_id,
    slug,
  });
}
