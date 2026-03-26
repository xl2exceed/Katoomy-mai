"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem("katoomy:installDismissed") === "1";
}

export default function InstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const [dismissed, setDismissed] = useState<boolean>(() =>
    getInitialDismissed(),
  );
  const [canInstall, setCanInstall] = useState(false);

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;
  if (!canInstall && !isIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">
                  Install for fast booking
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  1-tap access, reminders, and rewards.
                </div>
              </div>

              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={() => {
                  window.sessionStorage.setItem(
                    "katoomy:installDismissed",
                    "1",
                  );
                  setDismissed(true);
                }}
                aria-label="Dismiss install prompt"
              >
                ✕
              </button>
            </div>

            <div className="mt-3">
              {isIos ? (
                <div className="text-sm text-gray-800">
                  iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>.
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-2 font-semibold text-white"
                  style={{ backgroundColor: "#dc2626" }} // red-600
                  onClick={async () => {
                    const promptEvent = deferredPromptRef.current;
                    if (!promptEvent) return;

                    await promptEvent.prompt();
                    await promptEvent.userChoice;

                    deferredPromptRef.current = null;
                    setCanInstall(false);
                  }}
                >
                  Install App
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Optional: extra safe-space so it doesn't clash with phone UI bars */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
