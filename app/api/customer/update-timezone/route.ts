// PATCH /api/customer/update-timezone
// Silently updates a customer's timezone from the browser's Intl API.
// Called on dashboard load and after booking to keep timezone current.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const { phone, businessId, timezone } = await req.json();
  if (!phone || !businessId || !timezone) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Validate it looks like a real IANA timezone
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid timezone" }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  await supabaseAdmin
    .from("customers")
    .update({ timezone })
    .eq("business_id", businessId)
    .eq("phone", cleanPhone);

  return NextResponse.json({ ok: true });
}
