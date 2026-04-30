import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Katoomy - Grow Your Business",
  description:
    "Business management platform for service businesses. Smart scheduling, automated reminders, loyalty, and referrals.",
};

// This script runs inline before React hydration — zero flash guaranteed
const pwaRedirectScript = `
(function() {
  try {
    var isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (!isStandalone) return;

    // Only redirect from the root path
    if (window.location.pathname !== '/') return;

    // Try localStorage first, then cookie fallback (for iOS)
    var slug = null;
    try { slug = localStorage.getItem('katoomy:lastBusiness'); } catch(e) {}

    if (!slug || slug === 'undefined') {
      var match = document.cookie
        .split('; ')
        .find(function(r) { return r.startsWith('katoomy_lastBusiness='); });
      if (match) {
        try { slug = decodeURIComponent(match.split('=')[1]); } catch(e) {}
      }
    }

    if (!slug || slug === 'undefined') return;

    // Already on the right page — no redirect needed
    if (window.location.pathname.startsWith('/' + slug)) return;

    // Redirect immediately — before browser paints anything
    window.location.replace('/' + encodeURIComponent(slug));
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Inline PWA redirect — runs before first paint, eliminates flash */}
        <script dangerouslySetInnerHTML={{ __html: pwaRedirectScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
