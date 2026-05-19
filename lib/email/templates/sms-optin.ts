interface SmsOptinTemplateData {
  customerName: string;
  businessName: string;
  businessSlug: string;
  appUrl: string;
}

export function smsOptinEmailHtml(data: SmsOptinTemplateData): string {
  const { customerName, businessName, businessSlug, appUrl } = data;
  const optinLink = `${appUrl}/${businessSlug}?sms_optin=1`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stay in the Loop — ${businessName}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#059669,#0d9488);padding:32px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:40px;">💬</p>
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Never Miss an Update</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#a7f3d0;">Turn on SMS alerts from ${businessName}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <tr><td style="padding-bottom:24px;">
              <p style="margin:0;font-size:16px;color:#374151;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">We'd love to keep you in the loop via text message. Opt in to receive appointment reminders, confirmations, and exclusive offers — right to your phone.</p>
            </td></tr>

            <!-- Benefits -->
            <tr><td style="padding-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["📅", "Appointment reminders", "24-hour heads-up so you're always prepared"],
                  ["✅", "Instant confirmations", "Know right away when your booking is confirmed"],
                  ["🎉", "Special offers", "Be first to hear about promotions"],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:22px;width:36px;vertical-align:middle;">${icon}</td>
                        <td style="vertical-align:middle;padding-left:12px;">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${title}</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join("")}
              </table>
            </td></tr>

            <!-- CTA -->
            <tr><td style="text-align:center;padding-bottom:20px;">
              <a href="${optinLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;">
                Yes, Text Me! →
              </a>
            </td></tr>

            <tr><td style="text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Message &amp; data rates may apply. You can opt out any time by replying STOP.</p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you've booked with <strong>${businessName}</strong>.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
