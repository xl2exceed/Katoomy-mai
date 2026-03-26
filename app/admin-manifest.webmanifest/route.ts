import { NextResponse } from "next/server";

export function GET() {
  const manifest = {
    name: "Katoomy Business",
    short_name: "Katoomy Biz",
    description: "Manage your bookings and customers on the go",
    start_url: "/admin/mobile/menu",
    scope: "/admin/mobile/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
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
