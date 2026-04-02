// POST /api/staff/custom-payment
// Records a manual custom payment directly into alternative_payment_ledger.
// Auth via Bearer token (staff JWT).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const { serviceName, amountCents, customerName, paymentMethod, appointmentTs } = await req.json();
  if (!serviceName?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than $0" }, { status: 400 });

  const validMethods = ["cash", "cashapp", "other"];
  const method = validMethods.includes(paymentMethod) ? paymentMethod : "cash";

  const ts = appointmentTs ? new Date(appointmentTs) : new Date();
  const billingMonth = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;

  const { error } = await supabaseAdmin.from("alternative_payment_ledger").insert({
    business_id: staff.business_id,
    booking_id: null,
    customer_name: customerName?.trim() || null,
    service_name: serviceName.trim(),
    service_amount_cents: amountCents,
    tip_cents: 0,
    platform_fee_cents: 100,
    payment_method: method,
    fee_absorbed_by: "business",
    billing_month: billingMonth,
    billing_status: "pending",
    appointment_ts: ts.toISOString(),
    marked_paid_by: staff.id,
    notes: "Custom payment",
  });

  if (error) {
    console.error("[staff/custom-payment] Ledger insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}