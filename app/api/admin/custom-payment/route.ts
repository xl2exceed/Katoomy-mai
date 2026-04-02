// POST /api/admin/custom-payment
// Records a manual custom payment directly into alternative_payment_ledger.
// No booking record is created — this is for off-system services/products.
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

  const { serviceName, amountCents, tipCents, customerName, paymentMethod, appointmentTs } = await req.json();
  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  const validMethods = ["cash", "cashapp", "other"];
  const method = validMethods.includes(paymentMethod) ? paymentMethod : "cash";

  const ts = appointmentTs ? new Date(appointmentTs) : new Date();
  const billingMonth = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;

  const { error } = await supabaseAdmin.from("alternative_payment_ledger").insert({
    business_id: business.id,
    booking_id: null,
    customer_name: customerName?.trim() || null,
    service_name: serviceName.trim(),
    service_amount_cents: amountCents,
    tip_cents: tipCents ?? 0,
    platform_fee_cents: 100,
    payment_method: method,
    fee_absorbed_by: "business",
    billing_month: billingMonth,
    billing_status: "pending",
    appointment_ts: ts.toISOString(),
    notes: "Custom payment",
  });

  if (error) {
    console.error("[custom-payment] Ledger insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}