// GET /api/cron/resolve-payment-reports
// Runs every 30 minutes. Resolves pending payment reports where auto_resolve_at has passed.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: reports } = await supabaseAdmin
    .from("booking_payment_reports")
    .select("*")
    .eq("resolution_status", "pending")
    .lte("auto_resolve_at", now.toISOString());

  if (!reports || reports.length === 0) {
    return NextResponse.json({ success: true, resolved: 0 });
  }

  let resolved = 0;

  for (const report of reports) {
    const c = report.customer_response;
    const b = report.business_response;

    let resolution_status: string;
    let resolution_reason: string;
    let fee_should_charge: boolean;

    if (b === "paid") {
      resolution_status = "confirmed_paid";
      resolution_reason = "business_paid_only";
      fee_should_charge = true;
    } else if (c === "paid" && b === "paid") {
      resolution_status = "confirmed_paid";
      resolution_reason = "both_paid";
      fee_should_charge = true;
    } else if (c === "paid" && b === "unpaid") {
      resolution_status = "disputed_unpaid";
      resolution_reason = "customer_paid_business_unpaid";
      fee_should_charge = false;
    } else if (c === "paid" && b === "pending") {
      resolution_status = "auto_confirmed";
      resolution_reason = "customer_paid_business_timeout";
      fee_should_charge = true;
    } else {
      // both pending or customer unpaid
      resolution_status = "auto_confirmed";
      resolution_reason = "no_response_timeout";
      fee_should_charge = true;
    }

    await supabaseAdmin.from("booking_payment_reports").update({
      resolution_status,
      resolution_reason,
      fee_should_charge,
      resolved_at: now.toISOString(),
    }).eq("id", report.id);

    if (fee_should_charge) {
      // Mark booking as cash_paid if not already
      await supabaseAdmin.from("bookings")
        .update({ payment_status: "cash_paid" })
        .eq("id", report.booking_id)
        .in("payment_status", ["unpaid", "pending"]);

      // Record in ledger if not already there
      const { data: existing } = await supabaseAdmin
        .from("alternative_payment_ledger")
        .select("id").eq("booking_id", report.booking_id).maybeSingle();

      if (!existing) {
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
          notes: `Auto-resolved: ${resolution_reason}`,
        });
      }
    }

    resolved++;
  }

  return NextResponse.json({ success: true, resolved });
}
