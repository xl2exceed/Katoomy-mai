import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Public endpoint -- no auth required (customer claiming they sent Cash App payment)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { bookingId, totalCents } = body;

  if (!bookingId || !totalCents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Look up the booking to get business and customer info
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      business_id,
      total_price_cents,
      services(name, price_cents),
      customers(full_name, phone, referral_code)
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    console.error("[cashapp/customer-claim] Booking lookup failed:", bookingError?.message);
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const servicesArr = booking.services as unknown as { name: string; price_cents: number }[] | null;
  const serviceName = Array.isArray(servicesArr) ? servicesArr[0]?.name : null;
  const serviceAmountCents = booking.total_price_cents ?? 0;

  const customersArr = booking.customers as unknown as { full_name: string; phone: string; referral_code: string | null }[] | null;
  const customer = Array.isArray(customersArr) ? customersArr[0] : null;

  // Insert ledger entry -- billing_status must be 'pending' per table constraint
  const { error: ledgerError } = await supabaseAdmin
    .from("alternative_payment_ledger")
    .insert({
      business_id: booking.business_id,
      booking_id: bookingId,
      customer_name: customer?.full_name ?? null,
      customer_phone: customer?.phone ?? null,
      service_name: serviceName ?? null,
      service_amount_cents: serviceAmountCents,
      tip_cents: totalCents - serviceAmountCents > 0 ? totalCents - serviceAmountCents : 0,
      platform_fee_cents: 100,
      payment_method: "cashapp",
      fee_absorbed_by: "customer",
      billing_month: billingMonth,
      billing_status: "pending",
      notes: "Customer self-reported payment via Cash App -- awaiting staff confirmation",
    });

  if (ledgerError) {
    console.error("[cashapp/customer-claim] Ledger insert failed:", ledgerError.message);
  }

  // Update booking payment_status so dashboard hides the Pay Now button
  const { error: bookingUpdateError } = await supabaseAdmin
    .from("bookings")
    .update({ payment_status: "cashapp_pending" })
    .eq("id", bookingId);

  if (bookingUpdateError) {
    console.error("[cashapp/customer-claim] Booking update failed:", bookingUpdateError.message);
  }

  return NextResponse.json({
    success: true,
    referralCode: customer?.referral_code ?? null,
  });
}
