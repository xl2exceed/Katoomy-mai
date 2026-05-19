// POST /api/email/send-receipt
// Sends a booking receipt with partner offer QR codes to the customer.
// Called automatically on booking completion and manually via admin resend button.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM } from "@/lib/email/resend";
import { receiptEmailHtml } from "@/lib/email/templates/receipt";
import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.katoomy.com";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, isResend } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    // If called from an authenticated admin session, verify ownership
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

      // Verify booking belongs to this business
      const { data: ownerCheck } = await supabaseAdmin
        .from("bookings")
        .select("business_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (ownerCheck?.business_id !== biz.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch booking with related data
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(`
        id, total_price_cents, start_ts,
        customers(full_name, email),
        businesses(id, name, slug),
        services(name)
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const customer = booking.customers as unknown as { full_name: string | null; email: string | null } | null;
    const business = booking.businesses as unknown as { id: string; name: string; slug: string } | null;
    const service = booking.services as unknown as { name: string } | null;

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 422 });
    }

    // Fetch platform fee mode — add $1 if fee is passed to customer
    const { data: cashSettings } = await supabaseAdmin
      .from("cashapp_settings")
      .select("fee_mode")
      .eq("business_id", business!.id)
      .maybeSingle();
    const platformFeeCents = cashSettings?.fee_mode === "pass_to_customer" ? 100 : 0;

    // Fetch active partner offers for this business
    const { data: partners } = await supabaseAdmin
      .from("network_partners")
      .select("business_a_id, business_b_id")
      .or(`business_a_id.eq.${business!.id},business_b_id.eq.${business!.id}`)
      .eq("status", "active");

    const partnerIds = (partners || []).map((p) =>
      p.business_a_id === business!.id ? p.business_b_id : p.business_a_id
    );

    let partnerOffers: Awaited<ReturnType<typeof buildPartnerOffers>> = [];
    if (partnerIds.length > 0) {
      partnerOffers = await buildPartnerOffers(partnerIds, business!.id);
    }

    const appointmentDate = new Date(booking.start_ts).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const html = receiptEmailHtml({
      customerName: customer.full_name || "Valued Customer",
      businessName: business!.name,
      serviceName: service?.name || "Service",
      priceCents: booking.total_price_cents + platformFeeCents,
      appointmentDate,
      bookingId,
      partnerOffers,
    });

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM,
      to: customer.email,
      subject: `Your receipt from ${business!.name}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-receipt error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function buildPartnerOffers(partnerIds: string[], myBusinessId: string) {
  const { data: offers } = await supabaseAdmin
    .from("network_offers")
    .select("id, title, offer_type, amount, business_id, businesses(name, slug)")
    .in("business_id", partnerIds)
    .eq("active", true);

  if (!offers || offers.length === 0) return [];

  return Promise.all(
    offers.map(async (o) => {
      const biz = o.businesses as unknown as { name: string; slug: string } | null;
      const url = `${APP_URL}/${biz?.slug}?net_ref=${o.id}&via=${myBusinessId}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1 });
      return {
        id: o.id,
        title: o.title,
        offer_type: o.offer_type as "percent_off" | "dollar_off",
        amount: o.amount,
        partnerName: biz?.name || "Partner",
        partnerSlug: biz?.slug || "",
        qrDataUrl,
      };
    })
  );
}
