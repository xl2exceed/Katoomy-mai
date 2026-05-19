import { supabaseAdmin } from "@/lib/supabase/admin";
import { getResend, FROM } from "@/lib/email/resend";
import { receiptEmailHtml } from "@/lib/email/templates/receipt";
import { createHubCode } from "@/lib/hubCode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://katoomy.com";

async function buildPartnerOffers(
  partnerIds: string[],
  myBusinessId: string,
  customerPhone: string,
  customerId: string,
) {
  const { data: offers } = await supabaseAdmin
    .from("network_offers")
    .select("id, title, offer_type, amount, business_id, businesses(name, slug)")
    .in("business_id", partnerIds)
    .eq("active", true);

  if (!offers || offers.length === 0) return [];

  return Promise.all(
    offers.map(async (o) => {
      const biz = o.businesses as unknown as { name: string; slug: string } | null;
      let claimUrl = `${APP_URL}/hub`;
      try {
        const code = await createHubCode({
          phone: customerPhone,
          customerId,
          businessSlug: biz?.slug || "",
          netRefOfferId: o.id,
          netRefVia: myBusinessId,
        });
        claimUrl = `${APP_URL}/hub/add?c=${code}`;
      } catch (err) {
        console.error("Failed to create hub code for offer", o.id, err);
      }
      return {
        id: o.id,
        title: o.title,
        offer_type: o.offer_type as "percent_off" | "dollar_off",
        amount: o.amount,
        partnerName: biz?.name || "Partner",
        partnerSlug: biz?.slug || "",
        claimUrl,
      };
    })
  );
}

export async function sendReceiptEmail(bookingId: string): Promise<void> {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, total_price_cents, start_ts,
      customers(id, full_name, email, phone),
      businesses(id, name, slug),
      services(name)
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    console.error("[sendReceiptEmail] Booking not found:", bookingId);
    return;
  }

  const customer = booking.customers as unknown as { id: string; full_name: string | null; email: string | null; phone: string } | null;
  const business = booking.businesses as unknown as { id: string; name: string; slug: string } | null;
  const service = booking.services as unknown as { name: string } | null;

  if (!customer?.email) return; // No email on file — silently skip

  const { data: cashSettings } = await supabaseAdmin
    .from("cashapp_settings")
    .select("fee_mode")
    .eq("business_id", business!.id)
    .maybeSingle();
  const platformFeeCents = cashSettings?.fee_mode === "pass_to_customer" ? 100 : 0;

  const { data: partners } = await supabaseAdmin
    .from("network_partners")
    .select("business_a_id, business_b_id")
    .or(`business_a_id.eq.${business!.id},business_b_id.eq.${business!.id}`)
    .eq("status", "active");

  const partnerIds = (partners || []).map((p) =>
    p.business_a_id === business!.id ? p.business_b_id : p.business_a_id
  );

  let partnerOffers: Awaited<ReturnType<typeof buildPartnerOffers>> = [];
  if (partnerIds.length > 0 && customer.phone) {
    partnerOffers = await buildPartnerOffers(partnerIds, business!.id, customer.phone, customer.id);
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
    console.error("[sendReceiptEmail] Resend error:", error);
  }
}
