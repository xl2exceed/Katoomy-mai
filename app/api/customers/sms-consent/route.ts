// POST /api/customers/sms-consent
// Sets sms_marketing_consent = true for a customer.
// Called when a customer clicks the opt-in link from a campaign email.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { customerId, businessId } = await req.json().catch(() => ({}));

  if (!customerId || !businessId) {
    return NextResponse.json({ error: "Missing customerId or businessId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("customers")
    .update({
      sms_marketing_consent: true,
      sms_marketing_consent_at: new Date().toISOString(),
      sms_consent: true,
    })
    .eq("id", customerId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[sms-consent] DB error:", error);
    return NextResponse.json({ error: "Failed to update consent" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
