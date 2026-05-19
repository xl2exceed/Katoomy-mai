// GET /api/email/debug-receipt?bookingId=<id>&send=1
// Diagnostic endpoint — checks RESEND_API_KEY, customer email, and optionally sends a test.
// Protected by CRON_SECRET so it's not publicly callable.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getResend, FROM } from "@/lib/email/resend";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const shouldSend = req.nextUrl.searchParams.get("send") === "1";

  const result: Record<string, unknown> = {
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    RESEND_API_KEY_prefix: process.env.RESEND_API_KEY?.slice(0, 8) ?? "NOT SET",
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "(using default receipts@katoomy.com)",
    SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (!bookingId) {
    return NextResponse.json({ ...result, note: "Pass ?bookingId=<id> to check booking email" });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, total_price_cents, start_ts, payment_status, status, customers(id, full_name, email, phone), businesses(id, name, slug), services(name)")
    .eq("id", bookingId)
    .maybeSingle();

  result.booking_found = !!booking;
  result.booking_error = bookingError?.message ?? null;

  if (booking) {
    result.payment_status = booking.payment_status;
    result.booking_status = booking.status;

    const rawCustomer = booking.customers;
    const customerRaw = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
    const customer = customerRaw as { id: string; full_name: string | null; email: string | null; phone: string } | null;

    const rawBusiness = booking.businesses;
    const businessRaw = Array.isArray(rawBusiness) ? rawBusiness[0] : rawBusiness;
    const business = businessRaw as { id: string; name: string; slug: string } | null;

    result.customers_raw_is_array = Array.isArray(rawCustomer);
    result.customer_id = customer?.id ?? null;
    result.customer_email = customer?.email ?? "NULL";
    result.customer_phone = customer?.phone ? customer.phone.slice(0, 6) + "***" : "NULL";
    result.customer_name = customer?.full_name ?? "NULL";
    result.business_name = business?.name ?? "NULL";
    result.business_id = business?.id ?? "NULL";

    if (shouldSend && customer?.email) {
      try {
        const resend = getResend();
        const { data: sendData, error: sendError } = await resend.emails.send({
          from: FROM,
          to: customer.email,
          subject: `[DEBUG] Receipt test from ${business?.name ?? "Katoomy"}`,
          html: `<p>This is a diagnostic test email. Booking ID: ${bookingId}</p>`,
        });
        result.send_attempt = "yes";
        result.send_error = sendError?.message ?? null;
        result.send_id = sendData?.id ?? null;
        result.send_success = !sendError;
      } catch (err: unknown) {
        result.send_attempt = "yes";
        result.send_threw = err instanceof Error ? err.message : String(err);
        result.send_success = false;
      }
    } else if (shouldSend) {
      result.send_skipped_reason = "customer email is null";
    }
  }

  return NextResponse.json(result, { status: 200 });
}
