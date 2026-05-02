// POST /api/cron/bill-businesses
// Runs daily via cron-jobs.org. Finds businesses whose next_billing_date
// is today or past, counts completed bookings since last_billed_at,
// and charges their saved Stripe payment method $1 per completed booking.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Find businesses that are due for billing
  const { data: businesses, error: fetchErr } = await supabaseAdmin
    .from("businesses")
    .select("id, name, owner_email, stripe_customer_id, billing_interval, next_billing_date, last_billed_at, created_at")
    .lte("next_billing_date", today.toISOString())
    .not("next_billing_date", "is", null);

  if (fetchErr) {
    console.error("[bill-businesses] fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: "No businesses due for billing" });
  }

  const results: { business_id: string; status: string; amount_cents: number; bookings: number }[] = [];

  for (const biz of businesses) {
    const periodEnd = new Date(); // now
    // Period start = last billed date, or business created_at if never billed
    const periodStart = biz.last_billed_at
      ? new Date(biz.last_billed_at)
      : new Date(biz.created_at);

    // Count completed bookings in this billing period
    const { count } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", biz.id)
      .eq("status", "completed")
      .gte("updated_at", periodStart.toISOString())
      .lt("updated_at", periodEnd.toISOString());

    const completedCount = count ?? 0;
    const amountCents = completedCount * 100; // $1 per completed booking

    // Calculate next billing date before processing
    const nextDate = new Date(today);
    if (biz.billing_interval === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (biz.billing_interval === "bi-weekly") {
      nextDate.setDate(nextDate.getDate() + 14);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    const nextDateStr = nextDate.toISOString().split("T")[0];

    // Skip if no completed bookings
    if (amountCents === 0) {
      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: 0,
        amount_cents: 0,
        status: "skipped",
      });
      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);
      results.push({ business_id: biz.id, status: "skipped", amount_cents: 0, bookings: 0 });
      continue;
    }

    // Below Stripe minimum ($0.50) — shouldn't happen at $1/booking but guard anyway
    if (amountCents < 50) {
      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: completedCount,
        amount_cents: amountCents,
        status: "skipped",
        failure_message: "Below Stripe minimum charge",
      });
      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);
      results.push({ business_id: biz.id, status: "skipped_below_minimum", amount_cents: amountCents, bookings: completedCount });
      continue;
    }

    // No card on file
    if (!biz.stripe_customer_id) {
      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: completedCount,
        amount_cents: amountCents,
        status: "no_card",
      });
      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);
      results.push({ business_id: biz.id, status: "no_card", amount_cents: amountCents, bookings: completedCount });
      continue;
    }

    // Get saved payment method from Stripe
    let paymentMethodId: string | null = null;
    try {
      const pms = await stripe.customers.listPaymentMethods(biz.stripe_customer_id, { type: "card", limit: 1 });
      paymentMethodId = pms.data[0]?.id ?? null;
    } catch (pmErr) {
      console.error(`[bill-businesses] PM lookup failed for ${biz.id}:`, pmErr);
    }

    if (!paymentMethodId) {
      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: completedCount,
        amount_cents: amountCents,
        stripe_customer_id: biz.stripe_customer_id,
        status: "no_card",
        failure_message: "No payment method found on Stripe customer",
      });
      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);
      results.push({ business_id: biz.id, status: "no_card", amount_cents: amountCents, bookings: completedCount });
      continue;
    }

    // Charge the card
    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        customer: biz.stripe_customer_id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Katoomy platform fee — ${completedCount} completed booking${completedCount === 1 ? "" : "s"}`,
        metadata: { business_id: biz.id, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString() },
      });

      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: completedCount,
        amount_cents: amountCents,
        stripe_payment_intent_id: pi.id,
        stripe_customer_id: biz.stripe_customer_id,
        status: "paid",
      });

      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);

      results.push({ business_id: biz.id, status: "paid", amount_cents: amountCents, bookings: completedCount });
    } catch (chargeErr: unknown) {
      const msg = chargeErr instanceof Error ? chargeErr.message : String(chargeErr);
      console.error(`[bill-businesses] charge failed for ${biz.id}:`, msg);

      await supabaseAdmin.from("platform_billing_ledger").insert({
        business_id: biz.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        billing_interval: biz.billing_interval,
        completed_bookings: completedCount,
        amount_cents: amountCents,
        stripe_customer_id: biz.stripe_customer_id,
        status: "failed",
        failure_message: msg,
      });

      // Still advance the billing date so we don't retry forever
      await supabaseAdmin
        .from("businesses")
        .update({ last_billed_at: periodEnd.toISOString(), next_billing_date: nextDateStr })
        .eq("id", biz.id);

      results.push({ business_id: biz.id, status: "failed", amount_cents: amountCents, bookings: completedCount });
    }
  }

  const paid    = results.filter(r => r.status === "paid").length;
  const skipped = results.filter(r => r.status.startsWith("skipped")).length;
  const failed  = results.filter(r => r.status === "failed").length;
  const noCard  = results.filter(r => r.status === "no_card").length;

  return NextResponse.json({ success: true, processed: businesses.length, paid, skipped, failed, no_card: noCard, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
