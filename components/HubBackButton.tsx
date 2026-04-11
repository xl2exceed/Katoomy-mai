"use client";
// Shows a floating button in standalone (PWA) mode:
// - 1 business saved → "＋ Add Business" → goes to /hub (which shows the add panel)
// - 2+ businesses saved → "⊞ My Businesses" → goes to /hub (which shows the tile grid)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BUSINESSES_KEY = "katoomy:businesses";

export default function HubBackButton() {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "hub" | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    if (!standalone) return;

    try {
      const slugs: string[] = JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]");
      setMode(slugs.length >= 2 ? "hub" : "add");
    } catch {
      setMode("add");
    }
  }, []);

  if (!mode) return null;

  return (
    <button
      onClick={() => router.push("/hub")}
      className="fixed top-4 right-4 z-50 px-3 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-semibold shadow-lg active:scale-95 transition leading-tight text-center"
    >
      {mode === "hub" ? <>Business<br />Hub</> : <>Add<br />Business</>}
    </button>
  );
}
