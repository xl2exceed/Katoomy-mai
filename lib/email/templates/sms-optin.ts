interface SmsOptinTemplateData {
  customerName: string;
  businessName: string;
  businessSlug: string;
  appUrl: string;
  emailNumber: 1 | 2 | 3;
  customerId: string;
}

interface EmailVariant {
  subject: string;
  headline: string;
  subheadline: string;
  intro: string;
  benefits: [string, string, string][];
  ctaLabel: string;
  headerGradient: string;
  footerNote: string;
}

const VARIANTS: Record<1 | 2 | 3, EmailVariant> = {
  1: {
    subject: "Never miss an appointment",
    headline: "Get text reminders from",
    subheadline: "Opt in once — we'll handle the rest.",
    intro: "A quick text the day before your appointment means you'll never forget, never no-show, and never have to wonder if your booking is confirmed.",
    benefits: [
      ["📅", "Appointment reminders", "A heads-up 24 hours before so you're always ready"],
      ["✅", "Instant confirmations", "Know right away when your booking is locked in"],
      ["🔄", "Easy rescheduling", "Reply to any text to reschedule — no phone calls"],
    ],
    ctaLabel: "Turn On Text Alerts →",
    headerGradient: "linear-gradient(135deg,#059669,#0d9488)",
    footerNote: "Message & data rates may apply. Reply STOP any time to opt out.",
  },
  2: {
    subject: "VIP alerts — are you missing out?",
    headline: "Be first. Get the VIP text list.",
    subheadline: "Cancellations, exclusive deals, and priority openings — by text.",
    intro: "When a slot opens up last minute or an exclusive offer drops, we text our SMS list first. You've been missing these. One tap to get in.",
    benefits: [
      ["⚡️", "Cancellation alerts", "Last-minute openings go to SMS subscribers first"],
      ["🎉", "Exclusive discounts", "Deals that never go out to email"],
      ["🏆", "Priority booking", "SMS subscribers get early access to new time slots"],
    ],
    ctaLabel: "Yes, Text Me →",
    headerGradient: "linear-gradient(135deg,#7c3aed,#059669)",
    footerNote: "Message & data rates may apply. Reply STOP any time to opt out.",
  },
  3: {
    subject: "Quick question before we stop asking",
    headline: "One last ask — then we'll drop it.",
    subheadline: "Text alerts from",
    intro: "We won't keep sending these. This is the last time we'll ask. If you ever want appointment reminders or exclusive offers by text, one tap is all it takes. You can opt out any time by replying STOP.",
    benefits: [
      ["🔔", "Appointment reminders", "So you never miss a booking"],
      ["💬", "Two-way texting", "Reply to any message to reschedule or ask questions"],
      ["🚫", "Cancel any time", "Reply STOP and you're immediately removed"],
    ],
    ctaLabel: "Enable Text Alerts →",
    headerGradient: "linear-gradient(135deg,#374151,#059669)",
    footerNote: "This is our final opt-in request. Message & data rates may apply. Reply STOP any time.",
  },
};

export function smsOptinEmailSubject(emailNumber: 1 | 2 | 3, businessName: string): string {
  const v = VARIANTS[emailNumber];
  return emailNumber === 3
    ? `${v.subject} — ${businessName}`
    : `${v.subject} at ${businessName}`;
}

export function smsOptinEmailHtml(data: SmsOptinTemplateData): string {
  const { customerName, businessName, businessSlug, appUrl, emailNumber, customerId } = data;
  const optinLink = `${appUrl}/${businessSlug}?sms_optin=1&cid=${customerId}`;
  const v = VARIANTS[emailNumber];

  const headlineText = emailNumber === 3
    ? `${v.headline}`
    : `${v.headline} ${businessName}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headlineText}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr><td style="background:${v.headerGradient};padding:32px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:40px;">💬</p>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">${headlineText}</h1>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.75);">${v.subheadline}${emailNumber === 3 ? " " + businessName : ""}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <tr><td style="padding-bottom:24px;">
              <p style="margin:0;font-size:15px;color:#374151;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">${v.intro}</p>
            </td></tr>

            <!-- Benefits -->
            <tr><td style="padding-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${v.benefits.map(([icon, title, desc]) => `
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
                </tr>`).join("")}
              </table>
            </td></tr>

            <!-- CTA -->
            <tr><td style="text-align:center;padding-bottom:16px;">
              <a href="${optinLink}" style="display:inline-block;background:${v.headerGradient};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;">
                ${v.ctaLabel}
              </a>
            </td></tr>

            <tr><td style="text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">${v.footerNote}</p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you've booked with <strong>${businessName}</strong>. <a href="${appUrl}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
