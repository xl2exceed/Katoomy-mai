// POST /api/email/send-receipt
// Sends a booking receipt. Called manually via admin resend button.
// Automatic sending uses sendReceiptEmail() directly — no HTTP round-trip.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendReceiptEmail } from "@/lib/email/sendReceipt";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, isResend } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    if (isResend) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { data: biz } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

      const { data: ownerCheck } = await supabaseAdmin
        .from("bookings")
        .select("business_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (ownerCheck?.business_id !== biz.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await sendReceiptEmail(bookingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-receipt error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
