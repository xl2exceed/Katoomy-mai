interface AppInstallTemplateData {
  customerName: string;
  businessName: string;
  businessSlug: string;
  appUrl: string;
  discountText?: string;
}

export function appInstallEmailHtml(data: AppInstallTemplateData): string {
  const { customerName, businessName, businessSlug, appUrl, discountText } = data;
  const installLink = `${appUrl}/${businessSlug}`;

  const incentiveHtml = discountText ? `
    <tr><td style="padding-bottom:24px;">
      <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:12px;padding:20px 24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Exclusive App Offer</p>
        <p style="margin:0;font-size:22px;color:#ffffff;font-weight:800;">${discountText}</p>
      </div>
    </td></tr>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install the ${businessName} App</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:40px;">📱</p>
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Get the ${businessName} App</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#bfdbfe;">Book faster. Track your appointments. Earn rewards.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <tr><td style="padding-bottom:24px;">
              <p style="margin:0;font-size:16px;color:#374151;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">We noticed you haven't installed our app yet. With the app you can book in seconds, get appointment reminders, and earn loyalty points every visit.</p>
            </td></tr>

            ${incentiveHtml}

            <!-- Features -->
            <tr><td style="padding-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["⚡️", "Instant booking", "Book any service in under a minute"],
                  ["🔔", "Smart reminders", "Never miss an appointment"],
                  ["⭐️", "Loyalty rewards", "Earn points on every visit"],
                  ["🎁", "Exclusive offers", "App-only deals from partner businesses"],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
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
            <tr><td style="text-align:center;padding-bottom:8px;">
              <a href="${installLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;">
                Install the App →
              </a>
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
