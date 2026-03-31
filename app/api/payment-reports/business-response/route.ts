// POST /api/payment-reports/business-response
// Called when staff/admin taps "Paid" or "Unpaid" on a payment notification.
// "paid" = does everything Mark Paid does (booking, ledger, loyalty).
// "unpaid" = records dispute, sends SMS to customer.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStaffClient } from "@/lib/supabase/staff-client";

export async function POST(req: NextRequest) {
  // Support both admin (cookie) and staff (Bearer token) auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId: string | null = null;
  let staffId: string | null = null;

  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    userId = user?.id ?? null;
    if (userId) {
      const { data: staffRow } = await supabaseAdmin
        .from("staff").select("id").eq("user_id", userId).maybeSingle();
      staffId = staffRow?.id ?? null;
    }
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, response } = await req.json();
  if (!reportId || !["paid", "unpaid"].includes(response)) {
    return NextResponse.json({ error: "Missing reportId or invalid response" }, { status: 400 });
  }

  const { data: report } = await supabaseAdmin
    .from("booking_payment_reports")
    .select("*, bookings(total_price_cents, customer_id, business_id, status, payment_status), businesses(slug, name)")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.resolution_status !== "pending") {
    return NextResponse.json({ error: "This payment has already been resolved" }, { status: 400 });
  }

  const now = new Date();

  // Update business response
  await supabaseAdmin.from("booking_payment_reports").update({
    business_response: response,
    business_response_at: now.toISOString(),
    business_responded_by: staffId,
  }).eq("id", reportId);

  if (response === "paid") {
    // ── Mark booking paid ─────────────────────────────────────────────
    await supabaseAdmin.from("bookings")
      .update({ payment_status: "cash_paid", status: "completed" })
      .eq("id", report.booking_id);

    // ── Record in alternative_payment_ledger ──────────────────────────
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: existingLedger } = await supabaseAdmin
      .from("alternative_payment_ledger")
      .select("id").eq("booking_id", report.booking_id).maybeSingle();

    if (!existingLedger) {
      await supabaseAdmin.from("alternative_payment_ledger").insert({
        business_id: report.business_id,
        booking_id: report.booking_id,
        service_amount_cents: report.service_amount_cents,
        tip_cents: report.tip_cents,
        platform_fee_cents: report.fee_amount_cents,
        payment_method: report.payment_method,
        fee_absorbed_by: report.fee_amount_cents > 0 ? "customer" : "business",
        billing_month: billingMonth,
        billing_status: "pending",
        marked_paid_by: staffId,
        notes: `Confirmed by ${staffId ? "staff" : "admin"}`,
      });
    }

    // ── Award loyalty points ──────────────────────────────────────────
    const { data: loyalty } = await supabaseAdmin
      .from("loyalty_settings")
      .select("enabled, earn_on_completion, points_per_event, referral_enabled, referrer_reward_points")
      .eq("business_id", report.business_id).single();

    if (loyalty?.enabled && loyalty.earn_on_completion) {
      const { data: existing } = await supabaseAdmin.from("loyalty_ledger").select("id")
        .eq("related_booking_id", report.booking_id).eq("event_type", "completion").maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("loyalty_ledger").insert({
          business_id: report.business_id,
          customer_id: report.customer_id,
          event_type: "completion",
          points_delta: loyalty.points_per_event,
          related_booking_id: report.booking_id,
        });
      }
    }

    if (loyalty?.referral_enabled !== false) {
      const { data: referral } = await supabaseAdmin.from("referrals")
        .select("id, referrer_customer_id")
        .eq("business_id", report.business_id)
        .eq("referred_customer_id", report.customer_id)
        .eq("status", "pending").maybeSingle();
      if (referral) {
        const pts = loyalty?.referrer_reward_points ?? 15;
        const { data: existingRef } = await supabaseAdmin.from("loyalty_ledger").select("id")
          .eq("related_booking_id", report.booking_id).eq("event_type", "referral")
          .eq("customer_id", referral.referrer_customer_id).maybeSingle();
        if (!existingRef) {
          await supabaseAdmin.from("loyalty_ledger").insert({
            business_id: report.business_id,
            customer_id: referral.referrer_customer_id,
            points_delta: pts, event_type: "referral",
            related_booking_id: report.booking_id,
          });
        }
        await supabaseAdmin.from("referrals").update({
          status: "completed", reward_points_awarded: pts,
          first_completed_booking_id: report.booking_id,
          completed_at: now.toISOString(),
        }).eq("id", referral.id);
      }
    }

    // ── Resolve report ────────────────────────────────────────────────
    const reason = report.customer_response === "paid" ? "both_paid" : "business_paid_only";
    await supabaseAdmin.from("booking_payment_reports").update({
      resolution_status: "confirmed_paid",
      resolution_reason: reason,
      fee_should_charge: true,
      resolved_at: now.toISOString(),
    }).eq("id", reportId);

  } else {
    // ── Business says unpaid — send SMS to customer ───────────────────
    const { data: customer } = await supabaseAdmin
      .from("customers").select("phone, full_name").eq("id", report.customer_id).maybeSingle();

    const { data: biz } = await supabaseAdmin
      .from("businesses").select("slug, name").eq("id", report.business_id).maybeSingle();

    if (customer?.phone) {
      const amountDollars = (report.total_amount_cents / 100).toFixed(2);
      const payLink = `${process.env.NEXT_PUBLIC_APP_URL}/${biz?.slug}/dashboard`;
      const smsBody = `Hi ${customer.full_name || "there"}! ${biz?.name || "Your business"} did not receive your payment of $${amountDollars}. Please send payment or visit ${payLink} to pay online.`;

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: customer.phone,
          body: smsBody,
          business_id: report.business_id,
          customer_id: report.customer_id,
        }),
      });
    }

    // ── Resolve report as disputed ────────────────────────────────────
    await supabaseAdmin.from("booking_payment_reports").update({
      resolution_status: "disputed_unpaid",
      resolution_reason: "customer_paid_business_unpaid",
      fee_should_charge: false,
      dispute_counted: true,
      resolved_at: now.toISOString(),
    }).eq("id", reportId);
  }

  return NextResponse.json({ success: true });
}
