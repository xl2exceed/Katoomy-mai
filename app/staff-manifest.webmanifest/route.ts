import { NextResponse } from "next/server";

export function GET() {
  const manifest = {
    name: "Katoomy Staff",
    short_name: "Katoomy Staff",
    description: "View your schedule, bookings, and earnings",
    start_url: "/staff/dashboard",
    scope: "/staff/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
