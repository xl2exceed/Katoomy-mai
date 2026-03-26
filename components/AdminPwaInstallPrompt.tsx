"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AdminPwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !navigator.userAgent.includes("Chrome"),
  );
  const [showBanner, setShowBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return false;
    if (sessionStorage.getItem("adminInstallDismissed")) return false;
    if (
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !navigator.userAgent.includes("Chrome")
    )
      return true;
    return false;
  });
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("adminInstallDismissed", "1");
    setIsDismissed(true);
    setShowBanner(false);
  };

  if (!showBanner || isDismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 border-t border-gray-700 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0 text-xl">
            ✂️
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              Install Katoomy Business
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              Manage bookings from your home screen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isIos ? (
            <button
              onClick={() => setShowIosInstructions(!showIosInstructions)}
              className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-sm font-semibold"
            >
              How to Install
            </button>
          ) : (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-sm font-semibold"
            >
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white text-xl leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {/* iOS instructions */}
      {isIos && showIosInstructions && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-gray-300 text-xs font-semibold mb-2">
            To install on iPhone / iPad:
          </p>
          <ol className="text-gray-400 text-xs space-y-1">
            <li>
              1. Tap the <span className="text-white font-medium">Share</span>{" "}
              button at the bottom of Safari
            </li>
            <li>
              2. Scroll down and tap{" "}
              <span className="text-white font-medium">Add to Home Screen</span>
            </li>
            <li>
              3. Tap <span className="text-white font-medium">Add</span> in the
              top right
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
