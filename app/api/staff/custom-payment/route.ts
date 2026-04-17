// POST /api/staff/custom-payment
// Records a manual custom payment directly into alternative_payment_ledger.
// Auth via Bearer token (staff JWT).
// If bookingId is provided (custom-status booking), also marks the booking as custom_paid
// and awards loyalty points to the customer.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function awardLoyaltyOnPayment(businessId: string, customerId: string, bookingId: string) {
  const { data: loyalty } = await supabaseAdmin
    .from("loyalty_settings")
    .select("enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points")
    .eq("business_id", businessId)
    .single();
  if (loyalty?.enabled && loyalty.earn_on_completion) {
    const { data: existing } = await supabaseAdmin
      .from("loyalty_ledger").select("id")
      .eq("related_booking_id", bookingId).eq("event_type", "completion").maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("loyalty_ledger").insert({
        business_id: businessId, customer_id: customerId,
        event_type: "completion", points_delta: loyalty.points_per_event, related_booking_id: bookingId,
      });
    }
  }
  if (loyalty?.referral_enabled !== false) {
    const { data: referral } = await supabaseAdmin
      .from("referrals").select("id, referrer_customer_id")
      .eq("business_id", businessId).eq("referred_customer_id", customerId).eq("status", "pending").maybeSingle();
    if (referral) {
      const referrerPoints = loyalty?.referrer_reward_points ?? 15;
      const { data: existingRef } = await supabaseAdmin
        .from("loyalty_ledger").select("id")
        .eq("related_booking_id", bookingId).eq("event_type", "referral")
        .eq("customer_id", referral.referrer_customer_id).maybeSingle();
      if (!existingRef) {
        await supabaseAdmin.from("loyalty_ledger").insert({
          business_id: businessId, customer_id: referral.referrer_customer_id,
          points_delta: referrerPoints, event_type: "referral", related_booking_id: bookingId,
        });
      }
      await supabaseAdmin.from("referrals").update({
        status: "completed", reward_points_awarded: referrerPoints,
        first_completed_booking_id: bookingId, completed_at: new Date().toISOString(),
      }).eq("id", referral.id);
    }
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, business_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const {
    serviceName,
    amountCents,
    tipCents,
    customerName,
    paymentMethod,
    appointmentTs,
    bookingId,       // optional — passed when paying off a custom-status booking
    customerPhone,   // optional — passed alongside bookingId for ledger record
  } = await req.json();

  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  const validMethods = ["cash", "cashapp", "zelle", "card", "other"];
  const rawMethod = validMethods.includes(paymentMethod) ? paymentMethod : "cash";
  const method = rawMethod === "zelle" ? "other" : rawMethod;

  const ts = appointmentTs ? new Date(appointmentTs) : new Date();
  const billingMonth = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;

  const { data: cashSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", staff.business_id)
    .maybeSingle();
  const feeAbsorbedBy = cashSettings?.fee_mode === "business_absorbs" ? "business" : "customer";

  // If a bookingId is provided, verify it belongs to this business and is in custom status
  let resolvedBookingId: string | null = null;
  let resolvedCustomerId: string | null = null;
  if (bookingId) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, customer_id")
      .eq("id", bookingId)
      .eq("business_id", staff.business_id)
      .maybeSingle();
    if (booking && booking.status === "custom" && !["custom_paid", "paid", "cash_paid"].includes(booking.payment_status)) {
      resolvedBookingId = booking.id;
      resolvedCustomerId = booking.customer_id;
    }
  }

  const { error } = await supabaseAdmin.from("alternative_payment_ledger").insert({
    business_id: staff.business_id,
    booking_id: resolvedBookingId,
    customer_name: customerName?.trim() || null,
    customer_phone: customerPhone?.replace(/\D/g, "") || null,
    service_name: serviceName.trim(),
    service_amount_cents: amountCents,
    tip_cents: tipCents ?? 0,
    platform_fee_cents: 100,
    payment_method: method,
    fee_absorbed_by: feeAbsorbedBy,
    billing_month: billingMonth,
    billing_status: "pending",
    appointment_ts: ts.toISOString(),
    marked_paid_by: staff.id,
    notes: resolvedBookingId ? "Custom payment — linked booking" : "Custom payment",
  });

  if (error) {
    console.error("[staff/custom-payment] Ledger insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the linked booking as custom_paid so schedule + customer portal update
  if (resolvedBookingId) {
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "custom_paid" })
      .eq("id", resolvedBookingId);
    if (updateError) {
      console.error("[staff/custom-payment] Booking update error:", updateError.message);
      return NextResponse.json({ error: `Payment recorded in ledger but booking status could not be updated: ${updateError.message}` }, { status: 500 });
    }
    // Award loyalty points to the customer
    if (resolvedCustomerId) {
      await awardLoyaltyOnPayment(staff.business_id, resolvedCustomerId, resolvedBookingId);
    }
  }

  return NextResponse.json({ success: true });
}
