// POST /api/admin/custom-payment
// Records a manual custom payment directly into alternative_payment_ledger.
// If bookingId is provided (custom-status booking), also marks the booking as custom_paid
// so the schedule page and customer portal reflect the payment correctly.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const {
    serviceName,
    amountCents,
    tipCents,
    customerName,
    paymentMethod,
    appointmentTs,
    bookingId,        // optional — passed when paying off a custom-status booking
    customerPhone,    // optional — passed alongside bookingId for ledger record
  } = await req.json();

  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  const validMethods = ["cash", "cashapp", "zelle", "other", "card"];
  const method = validMethods.includes(paymentMethod) ? paymentMethod : "cash";

  const ts = appointmentTs ? new Date(appointmentTs) : new Date();
  const billingMonth = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;

  // If a bookingId is provided, verify it belongs to this business and is in custom status
  let resolvedBookingId: string | null = null;
  if (bookingId) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status")
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (booking && booking.status === "custom" && !["custom_paid", "paid", "cash_paid"].includes(booking.payment_status)) {
      resolvedBookingId = booking.id;
    }
  }

  const { error } = await supabaseAdmin.from("alternative_payment_ledger").insert({
    business_id: business.id,
    booking_id: resolvedBookingId,
    customer_name: customerName?.trim() || null,
    customer_phone: customerPhone?.replace(/\D/g, "") || null,
    service_name: serviceName.trim(),
    service_amount_cents: amountCents,
    tip_cents: tipCents ?? 0,
    platform_fee_cents: 100,
    payment_method: method,
    fee_absorbed_by: "business",
    billing_month: billingMonth,
    billing_status: "pending",
    appointment_ts: ts.toISOString(),
    notes: resolvedBookingId ? "Custom payment — linked booking" : "Custom payment",
  });

  if (error) {
    console.error("[custom-payment] Ledger insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the linked booking as custom_paid so schedule + customer portal update
  if (resolvedBookingId) {
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "custom_paid" })
      .eq("id", resolvedBookingId);
    if (updateError) {
      console.error("[custom-payment] Booking update error:", updateError.message);
      // Non-fatal: ledger entry already recorded, just log it
    }
  }

  return NextResponse.json({ success: true });
}
