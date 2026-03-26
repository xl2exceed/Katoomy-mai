"use client";

import { useEffect } from "react";

export default function StaffSwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/staff-sw.js", { scope: "/staff/" })
        .then((reg) => console.log("Staff SW registered", reg.scope))
        .catch((err) => console.error("Staff SW registration failed", err));
    }
  }, []);

  return null;
}
