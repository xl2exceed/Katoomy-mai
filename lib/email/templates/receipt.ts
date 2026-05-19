interface PartnerOffer {
  id: string;
  title: string;
  offer_type: "percent_off" | "dollar_off";
  amount: number;
  partnerName: string;
  partnerSlug: string;
  claimUrl: string;
}

interface ReceiptTemplateData {
  customerName: string;
  businessName: string;
  serviceName: string;
  priceCents: number;
  appointmentDate: string;
  bookingId: string;
  partnerOffers: PartnerOffer[];
}

function formatOffer(o: PartnerOffer): string {
  if (o.offer_type === "percent_off") return `${o.amount}% off`;
  if (o.offer_type === "dollar_off") return `$${o.amount} off`;
  return "Free service";
}

export function receiptEmailHtml(data: ReceiptTemplateData): string {
  const { customerName, businessName, serviceName, priceCents, appointmentDate, partnerOffers } = data;
  const total = `$${(priceCents / 100).toFixed(2)}`;

  const offersHtml = partnerOffers.length === 0 ? "" : `
    <tr><td style="padding:32px 0 0;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">Exclusive Partner Discounts</h2>
      <p style="margin:0 0 6px;font-size:13px;color:#374151;">As a thank-you for your visit, you've unlocked these discounts at partner businesses in the Katoomy network.</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Tap any offer to add it to your Katoomy app. Offers are valid for <strong>15 days</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${partnerOffers.map((o) => `
        <tr>
          <td style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;display:block;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">${o.partnerName}</p>
                  <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#2563eb;">${formatOffer(o)}</p>
                  <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">${o.title}</p>
                  <a href="${o.claimUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:50px;">
                    Claim in Katoomy App →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
        `).join("")}
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">Don't have the Katoomy app? Tap any offer to get started.</p>
    </td></tr>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt — ${businessName}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Receipt</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#bfdbfe;">${businessName}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <!-- Greeting -->
            <tr><td style="padding-bottom:24px;">
              <p style="margin:0;font-size:16px;color:#374151;">Hi <strong>${customerName}</strong>, thank you for your visit! Here's your receipt.</p>
            </td></tr>

            <!-- Booking details card -->
            <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280;padding-bottom:12px;">Service</td>
                  <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:12px;">${serviceName}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280;padding-bottom:12px;">Date</td>
                  <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding-bottom:12px;">${appointmentDate}</td>
                </tr>
                <tr>
                  <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:12px;"></td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#111827;font-weight:700;">Total</td>
                  <td style="font-size:18px;color:#2563eb;font-weight:800;text-align:right;">${total}</td>
                </tr>
              </table>
            </td></tr>

            ${offersHtml}

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Powered by <strong>Katoomy</strong> · Questions? Contact ${businessName} directly.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
