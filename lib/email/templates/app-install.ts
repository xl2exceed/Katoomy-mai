interface AppInstallTemplateData {
  customerName: string;
  businessName: string;
  businessSlug: string;
  appUrl: string;
  emailNumber: 1 | 2 | 3;
  brandColor?: string;
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

interface EmailVariant {
  subject: string;
  headline: string;
  subheadline: string;
  intro: string;
  features: [string, string, string][];
  ctaLabel: string;
  headerGradient: string;
}

const VARIANTS: Record<1 | 2 | 3, EmailVariant> = {
  1: {
    subject: "Skip the hassle next time",
    headline: "Rebook in seconds. Earn rewards every visit.",
    subheadline: "Your appointments, your rewards — one tap away.",
    intro: "Next time you need to book, skip the form. With the app you can rebook your last appointment in one tap, track your loyalty points, and get reminders automatically.",
    features: [
      ["⚡️", "One-tap rebooking", "Book your usual service in seconds"],
      ["⭐️", "Loyalty rewards", "Earn points on every visit — redeem for discounts"],
      ["🔔", "Smart reminders", "Never miss an appointment again"],
    ],
    ctaLabel: "Install the App →",
    headerGradient: "linear-gradient(135deg,#2563eb,#4f46e5)",
  },
  2: {
    subject: "Your rewards are piling up",
    headline: "Check your loyalty points in the app.",
    subheadline: "Most customers now manage their bookings through the app.",
    intro: "Every visit earns you points toward your next reward. The app is the only place to see your balance, claim rewards, and share your referral link with friends.",
    features: [
      ["🎁", "Claim rewards", "See your points balance and redeem any time"],
      ["🙌", "Refer & earn", "Share your link — you both get rewarded"],
      ["📅", "Manage bookings", "View, reschedule, or cancel in the app"],
    ],
    ctaLabel: "Check My Rewards →",
    headerGradient: "linear-gradient(135deg,#7c3aed,#2563eb)",
  },
  3: {
    subject: "Last chance to grab your perks",
    headline: "Your exclusive perks are waiting.",
    subheadline: "App members get early access and special offers.",
    intro: "A quick install is all it takes to unlock faster rebooking, exclusive app-only deals, and early access to open slots. Takes less than 30 seconds on your phone.",
    features: [
      ["🏆", "VIP treatment", "App members get priority booking and early access"],
      ["💰", "Exclusive deals", "App-only offers you won't get anywhere else"],
      ["📲", "30-second install", "No app store needed — installs straight from your browser"],
    ],
    ctaLabel: "Get the App Now →",
    headerGradient: "linear-gradient(135deg,#0d9488,#2563eb)",
  },
};

export function appInstallEmailSubject(emailNumber: 1 | 2 | 3, businessName: string): string {
  return `${VARIANTS[emailNumber].subject} — ${businessName}`;
}

export function appInstallEmailHtml(data: AppInstallTemplateData): string {
  const { customerName, businessName, businessSlug, appUrl, emailNumber, brandColor } = data;
  const installLink = `${appUrl}/${businessSlug}`;
  const v = VARIANTS[emailNumber];
  const headerBg = brandColor ? `linear-gradient(135deg, ${brandColor}, ${darken(brandColor, 40)})` : v.headerGradient;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${v.headline}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Katoomy brand bar -->
        <tr><td style="background:#ffffff;padding:14px 40px;text-align:center;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;background:#2563eb;border-radius:7px;padding:3px 10px;font-size:14px;font-weight:900;color:#ffffff;vertical-align:middle;letter-spacing:0.3px;">K</span>
          <span style="font-size:16px;font-weight:800;color:#111827;vertical-align:middle;margin-left:8px;">Katoomy</span>
        </td></tr>

        <!-- Header -->
        <tr><td style="background:${headerBg};padding:28px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:0.5px;text-transform:uppercase;">${businessName}</p>
          <p style="margin:0 0 8px;font-size:36px;">📱</p>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">${v.headline}</h1>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.75);">${v.subheadline}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            <tr><td style="padding-bottom:24px;">
              <p style="margin:0;font-size:15px;color:#374151;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">${v.intro}</p>
            </td></tr>

            <!-- Features -->
            <tr><td style="padding-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${v.features.map(([icon, title, desc]) => `
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
            <tr><td style="text-align:center;padding-bottom:8px;">
              <a href="${installLink}" style="display:inline-block;background:${headerBg};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:50px;">
                ${v.ctaLabel}
              </a>
            </td></tr>

            <tr><td style="text-align:center;padding-top:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Opens in Safari/Chrome — no app store required.</p>
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
