// POST /api/admin/take-payment
// Admin-initiated payment: cash booking or Stripe QR URL. Cookie auth, no staffId required.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureUniqueReferralCode } from "@/lib/utils/generateReferralCode";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mode, serviceId, customerName, customerPhone } = await req.json();
  if (!mode || !serviceId || !customerName || !customerPhone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, slug")
    .eq("owner_user_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const businessId = business.id;

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("id, name, price_cents, duration_minutes")
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .single();

  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const cleanPhone = customerPhone.replace(/\D/g, "");
  const now = new Date();
  const endTime = new Date(now.getTime() + service.duration_minutes * 60000);

  // Upsert customer
  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", cleanPhone)
    .maybeSingle();

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabaseAdmin.from("customers").update({ full_name: customerName }).eq("id", customerId);
  } else {
    const referralCode = await ensureUniqueReferralCode(supabaseAdmin, businessId, customerName, cleanPhone);
    const { data: newCust } = await supabaseAdmin
      .from("customers")
      .insert({ business_id: businessId, full_name: customerName, phone: cleanPhone, referral_code: referralCode })
      .select()
      .single();
    customerId = newCust!.id;
  }

  // Look for most recent unpaid/deposit-paid booking
  const { data: existingUnpaidBooking } = await supabaseAdmin
    .from("bookings")
    .select("id, start_ts, total_price_cents, deposit_amount_cents, payment_status")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .in("payment_status", ["unpaid", "deposit_paid"])
    .in("status", ["completed", "confirmed", "custom"])
    .order("start_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingBookingId = existingUnpaidBooking?.id || null;

  // Resolve member discount for walk-in payments (no pre-existing booking)
  let memberDiscountedPriceCents = service.price_cents;
  if (!existingUnpaidBooking) {
    const { data: memberSub } = await supabaseAdmin
      .from("member_subscriptions")
      .select("plan_id")
      .eq("customer_id", customerId)
      .eq("business_id", businessId)
      .eq("status", "active")
      .maybeSingle();
    if (memberSub?.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("membership_plans")
        .select("discount_percent")
        .eq("id", memberSub.plan_id)
        .single();
      if (plan && plan.discount_percent > 0) {
        memberDiscountedPriceCents = Math.round(service.price_cents * (1 - plan.discount_percent / 100));
      }
    }
  }

  const depositPaid = existingUnpaidBooking?.deposit_amount_cents ?? 0;
  const fullPrice =
    existingUnpaidBooking?.payment_status === "deposit_paid"
      ? (existingUnpaidBooking.total_price_cents > depositPaid
          ? existingUnpaidBooking.total_price_cents
          : service.price_cents)
      : existingUnpaidBooking?.payment_status === "unpaid"
        ? existingUnpaidBooking.total_price_cents
        : memberDiscountedPriceCents;
  const chargeAmountCents =
    existingUnpaidBooking?.payment_status === "deposit_paid"
      ? fullPrice - depositPaid
      : fullPrice;

  // Platform fee baked into cash charge when passed to customer
  const { data: cashSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", businessId)
    .maybeSingle();
  const platformFee = cashSettings?.fee_mode === "business_absorbs" ? 0 : 100;

  // ── Cash payment ──────────────────────────────────────────────────────────
  if (mode === "cash") {
    let cashBookingId: string;

    if (existingBookingId) {
      const { error: updateErr } = await supabaseAdmin
        .from("bookings")
        .update({ payment_status: "cash_paid", status: "completed" })
        .eq("id", existingBookingId);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      cashBookingId = existingBookingId;
    } else {
      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          service_id: serviceId,
          start_ts: now.toISOString(),
          end_ts: endTime.toISOString(),
          status: "completed",
          total_price_cents: service.price_cents + platformFee,
          payment_status: "cash_paid",
          customer_notes: "Walk-in — admin collected cash",
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cashBookingId = booking.id;
    }

    await awardLoyaltyOnPayment(businessId, customerId, cashBookingId);

    // Record in alternative payment ledger for billing
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await supabaseAdmin.from("alternative_payment_ledger").insert({
      business_id: businessId,
      booking_id: cashBookingId,
      customer_name: customerName,
      customer_phone: cleanPhone,
      service_name: service.name,
      service_amount_cents: chargeAmountCents + platformFee,
      tip_cents: 0,
      platform_fee_cents: platformFee,
      payment_method: "cash",
      fee_absorbed_by: cashSettings?.fee_mode === "business_absorbs" ? "business" : "customer",
      billing_month: billingMonth,
      billing_status: "pending",
      marked_paid_by: null,
      appointment_ts: existingUnpaidBooking?.start_ts ?? now.toISOString(),
      notes: "Cash payment recorded by admin",
    });

    return NextResponse.json({ success: true, bookingId: cashBookingId });
  }

  // ── Card / QR payment ────────────────────────────────────────────────────
  let qrBookingId = existingBookingId;
  if (!qrBookingId) {
    const { data: newBooking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        service_id: serviceId,
        start_ts: now.toISOString(),
        end_ts: endTime.toISOString(),
        status: "confirmed",
        total_price_cents: chargeAmountCents,
        payment_status: "unpaid",
        customer_notes: "Walk-in — admin QR payment pending",
      })
      .select("id")
      .single();

    if (bookingError) return NextResponse.json({ error: bookingError.message }, { status: 500 });
    qrBookingId = newBooking.id;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";
  return NextResponse.json({ bookingUrl: `${origin}/${business.slug}/pay-qr/${qrBookingId}` });
}
