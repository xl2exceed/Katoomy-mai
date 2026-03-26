import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Katoomy",
    short_name: "Katoomy",
    description:
      "Smart scheduling, loyalty and customer growth for barber shops.",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- 'id' is valid Web App Manifest spec but not yet typed in Next.js
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#422354",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
