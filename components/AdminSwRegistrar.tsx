"use client";

import { useEffect } from "react";

export default function AdminSwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/admin-sw.js", { scope: "/admin/mobile/" })
        .then((reg) => console.log("✅ Admin SW registered", reg.scope))
        .catch((err) => console.error("❌ Admin SW registration failed", err));
    }
  }, []);

  return null;
}
