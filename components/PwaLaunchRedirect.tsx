"use client";

import { useEffect, useMemo } from "react";

function isStandalonePwa(): boolean {
  // Android/Chrome
  const standaloneDisplayMode =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;

  // iOS Safari (typed, no `any`)
  const iosStandalone = Boolean(
    (window.navigator as unknown as { standalone?: boolean }).standalone,
  );

  return standaloneDisplayMode || iosStandalone;
}

export default function PwaLaunchRedirect({
  redirectToDashboard = true,
}: {
  redirectToDashboard?: boolean;
}) {
  const info = useMemo(() => {
    // Must be in browser
    if (typeof window === "undefined") return { should: false, target: "" };

    if (!isStandalonePwa()) return { should: false, target: "" };

    const last = localStorage.getItem("katoomy:lastBusiness");
    if (!last || last === "undefined") return { should: false, target: "" };

    // Avoid redirect loops if we’re already inside the business
    const currentPath = window.location.pathname;
    if (currentPath.startsWith(`/${last}`))
      return { should: false, target: "" };

    // Only redirect when launching at homepage
    if (currentPath !== "/") return { should: false, target: "" };

    const target = redirectToDashboard
      ? `/${encodeURIComponent(last)}/dashboard`
      : `/${encodeURIComponent(last)}`;

    return { should: true, target };
  }, [redirectToDashboard]);

  useEffect(() => {
    if (!info.should) return;
    window.location.replace(info.target);
  }, [info.should, info.target]);

  // If we’re about to redirect, render a full-screen neutral overlay
  if (info.should) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <div className="text-gray-800 text-sm">
          Opening your booking portal…
        </div>
      </div>
    );
  }

  return null;
}
