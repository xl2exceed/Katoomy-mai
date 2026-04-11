"use client";
// Shows a floating "My Businesses" button when the app is running as a PWA
// and the customer has more than one Katoomy business saved.
// Tapping it navigates to /hub.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BUSINESSES_KEY = "katoomy:businesses";

export default function HubBackButton() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    if (!standalone) return;

    try {
      const slugs: string[] = JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]");
      if (slugs.length >= 2) setShow(true);
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => router.push("/hub")}
      className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-semibold shadow-lg"
    >
      ← My Businesses
    </button>
  );
}
