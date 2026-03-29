// GET /api/cron/monthly-billing
// Vercel cron — runs on the 1st of every month at 9 AM.
// Aggregates pending alternative payment ledger entries per business,
// creates a monthly_platform_billing record, and charges via Stripe.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

// Do not specify apiVersion to avoid TypeScript mismatch with project Stripe types
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bill for the PREVIOUS month
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const billingMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  console.log(`[monthly-billing] Processing billing for month: ${billingMonth}`);

  // Get all pending ledger entries for the previous month
  const { data: ledgerEntries, error: ledgerError } = await supabaseAdmin
    .from("alternative_payment_ledger")
    .select("business_id, platform_fee_cents, id")
    .eq("billing_month", billingMonth)
    .eq("billing_status", "pending");

  if (ledgerError) {
    console.error("[monthly-billing] Ledger fetch error:", ledgerError.message);
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  if (!ledgerEntries || ledgerEntries.length === 0) {
    console.log("[monthly-billing] No pending entries for", billingMonth);
    return NextResponse.json({ success: true, processed: 0, billingMonth });
  }

  // Group by business
  const byBusiness: Record<string, { totalFees: number; count: number; ids: string[] }> = {};
  for (const entry of ledgerEntries) {
    if (!byBusiness[entry.business_id]) {
      byBusiness[entry.business_id] = { totalFees: 0, count: 0, ids: [] };
    }
    byBusiness[entry.business_id].totalFees += entry.platform_fee_cents;
    byBusiness[entry.business_id].count += 1;
    byBusiness[entry.business_id].ids.push(entry.id);
  }

  const results: Array<{ businessId: string; status: string; amount: number; error?: string }> = [];

  for (const [businessId, summary] of Object.entries(byBusiness)) {
    try {
      // Get business Stripe customer ID
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("id, name, stripe_customer_id")
        .eq("id", businessId)
        .maybeSingle();

      if (!business) {
        results.push({ businessId, status: "skipped", amount: summary.totalFees, error: "Business not found" });
        continue;
      }

      // Upsert billing record
      const { data: billingRecord, error: billingError } = await supabaseAdmin
        .from("monthly_platform_billing")
        .upsert({
          business_id: businessId,
          billing_month: billingMonth,
          total_transactions: summary.count,
          total_fees_cents: summary.totalFees,
          stripe_customer_id: business.stripe_customer_id ?? null,
          status: business.stripe_customer_id ? "pending" : "no_card",
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id,billing_month" })
        .select()
        .single();

      if (billingError) {
        console.error(`[monthly-billing] Billing record error for ${businessId}:`, billingError.message);
        results.push({ businessId, status: "failed", amount: summary.totalFees, error: billingError.message });
        continue;
      }

      if (!business.stripe_customer_id) {
        console.warn(`[monthly-billing] No Stripe customer for business ${businessId} — flagged as no_card`);
        results.push({ businessId, status: "no_card", amount: summary.totalFees });
        continue;
      }

      // Charge via Stripe
      const charge = await stripe.charges.create({
        amount: summary.totalFees,
        currency: "usd",
        customer: business.stripe_customer_id,
        description: `Katoomy platform fees — ${billingMonth} (${summary.count} alternative payment${summary.count !== 1 ? "s" : ""})`,
        metadata: {
          business_id: businessId,
          billing_month: billingMonth,
          transaction_count: String(summary.count),
        },
      });

      // Mark billing record as charged
      await supabaseAdmin
        .from("monthly_platform_billing")
        .update({
          status: "charged",
          stripe_charge_id: charge.id,
          charged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", billingRecord!.id);

      // Mark ledger entries as billed
      await supabaseAdmin
        .from("alternative_payment_ledger")
        .update({ billing_status: "billed" })
        .in("id", summary.ids);

      results.push({ businessId, status: "charged", amount: summary.totalFees });
      console.log(`[monthly-billing] Charged $${(summary.totalFees / 100).toFixed(2)} to business ${businessId}`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[monthly-billing] Stripe charge failed for ${businessId}:`, message);

      await supabaseAdmin
        .from("monthly_platform_billing")
        .update({
          status: "failed",
          failure_reason: message,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId)
        .eq("billing_month", billingMonth);

      results.push({ businessId, status: "failed", amount: summary.totalFees, error: message });
    }
  }

  const charged = results.filter((r) => r.status === "charged").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const noCard = results.filter((r) => r.status === "no_card").length;

  console.log(`[monthly-billing] Done. Charged: ${charged}, Failed: ${failed}, No card: ${noCard}`);
  return NextResponse.json({ success: true, billingMonth, charged, failed, noCard, results });
}
