// POST /api/cashapp/mark-paid
// Called by staff when a customer completes a Cash App payment.
// Creates a ledger entry for the $1 platform fee and updates the booking payment_status.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    bookingId,
    businessId,
    customerName,
    customerPhone,
    serviceName,
    serviceAmountCents,
    tipCents = 0,
    paymentMethod = "cashapp",
    staffId,
    notes,
  } = body;

  if (!bookingId || !businessId || !serviceAmountCents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the business belongs to the authenticated user
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, stripe_customer_id")
    .eq("id", businessId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Get Cash App settings to determine fee mode
  const { data: cashappSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", businessId)
    .maybeSingle();

  const feeMode = cashappSettings?.fee_mode ?? "pass_to_customer";
  const feeAbsorbedBy = feeMode === "business_absorbs" ? "business" : "customer";

  // Build billing month key e.g. "2026-03"
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Insert ledger entry
  const { data: ledgerEntry, error: ledgerError } = await supabaseAdmin
    .from("alternative_payment_ledger")
    .insert({
      business_id: businessId,
      booking_id: bookingId,
      customer_name: customerName ?? null,
      customer_phone: customerPhone ?? null,
      service_name: serviceName ?? null,
      service_amount_cents: serviceAmountCents,
      tip_cents: tipCents,
      platform_fee_cents: 100, // $1.00
      payment_method: paymentMethod,
      fee_absorbed_by: feeAbsorbedBy,
      billing_month: billingMonth,
      billing_status: "pending",
      marked_paid_by: staffId ?? null,
      marked_paid_at: now.toISOString(),
      notes: notes ?? null,
    })
    .select()
    .single();

  if (ledgerError) {
    console.error("[cashapp/mark-paid] Ledger error:", ledgerError.message);
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  // Update booking payment_status to 'paid'
  await supabaseAdmin
    .from("bookings")
    .update({ payment_status: "paid", updated_at: now.toISOString() })
    .eq("id", bookingId);

  return NextResponse.json({
    success: true,
    ledgerEntry,
    platformFeeCents: 100,
    feeAbsorbedBy,
    billingMonth,
  });
}
