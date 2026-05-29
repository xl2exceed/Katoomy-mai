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
        console.error("[sendReceiptEmail] hub code error for offer", o.id, err);
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
  console.log("[sendReceiptEmail] called for booking:", bookingId);

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, total_price_cents, start_ts,
      customers(id, full_name, email, phone, timezone),
      businesses(id, name, slug, primary_color),
      services(name)
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("[sendReceiptEmail] DB error:", bookingError);
    return;
  }

  if (!booking) {
    console.error("[sendReceiptEmail] booking not found:", bookingId);
    return;
  }

  // Supabase may return embedded relations as array or single object depending on schema
  const rawCustomer = booking.customers;
  const customerRaw = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
  const customer = customerRaw as { id: string; full_name: string | null; email: string | null; phone: string; timezone?: string | null } | null;

  const rawBusiness = booking.businesses;
  const businessRaw = Array.isArray(rawBusiness) ? rawBusiness[0] : rawBusiness;
  const business = businessRaw as { id: string; name: string; slug: string; primary_color?: string } | null;

  const rawService = booking.services;
  const serviceRaw = Array.isArray(rawService) ? rawService[0] : rawService;
  const service = serviceRaw as { name: string } | null;

  console.log("[sendReceiptEmail] customer:", customer?.email ?? "NO EMAIL", "business:", business?.name ?? "NONE");

  if (!customer?.email) {
    console.log("[sendReceiptEmail] skipping — no email on file for booking", bookingId);
    return;
  }

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
    timeZone: customer?.timezone || "America/New_York",
  });

  const html = receiptEmailHtml({
    customerName: customer.full_name || "Valued Customer",
    businessName: business!.name,
    serviceName: service?.name || "Service",
    priceCents: booking.total_price_cents + platformFeeCents,
    appointmentDate,
    bookingId,
    partnerOffers,
    brandColor: business!.primary_color || undefined,
  });

  console.log("[sendReceiptEmail] sending to:", customer.email);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: customer.email,
    subject: `Your receipt from ${business!.name}`,
    html,
  });

  if (error) {
    console.error("[sendReceiptEmail] Resend error:", error);
  } else {
    console.log("[sendReceiptEmail] sent successfully to:", customer.email);
  }
}
