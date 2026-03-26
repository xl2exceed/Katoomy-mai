"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

interface BusinessData {
  name: string;
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  welcome_message: string | null;
}

interface InstallGateProps {
  business: BusinessData;
  slug: string;
  children: React.ReactNode;
}

const SKIP_KEY = "katoomy:installSkipped";
const LAST_BUSINESS_KEY = "katoomy:lastBusiness";

// Save slug to BOTH localStorage and a cookie so iOS PWA can read it
// (iOS PWA and Safari have separate localStorage, but share cookies)
function saveLastBusiness(slug: string) {
  try {
    localStorage.setItem(LAST_BUSINESS_KEY, slug);
  } catch {}
  // Cookie accessible to the PWA on same origin - 1 year expiry
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `katoomy_lastBusiness=${encodeURIComponent(slug)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export default function InstallGate({
  business,
  slug,
  children,
}: InstallGateProps) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [showFloatingInstall, setShowFloatingInstall] = useState(false);

  const [isStandalone] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean(
          (window.navigator as unknown as { standalone?: boolean }).standalone,
        )),
  );

  const [skipped, setSkipped] = useState(
    () =>
      typeof window !== "undefined" && localStorage.getItem(SKIP_KEY) === "1",
  );

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) && !ua.includes("chrome");
  }, []);

  useEffect(() => {
    // ✅ Save slug to both localStorage AND cookie
    // Cookie survives the iOS Safari → PWA context switch
    saveLastBusiness(slug);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      setShowFloatingInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [slug]);

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    setInstalling(true);
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setInstalling(false);
    if (outcome === "accepted") {
      setCanInstall(false);
      setShowFloatingInstall(false);
      setInstalled(true);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(SKIP_KEY, "1");
    setSkipped(true);
  };

  const primaryColor = business.primary_color || "#3B82F6";

  if (isStandalone) return <>{children}</>;

  if (skipped) {
    return (
      <>
        {children}
        {canInstall && (
          <button
            onClick={handleInstall}
            className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl"
            style={{ backgroundColor: primaryColor }}
          >
            📲 Install App
          </button>
        )}
        {isIos && showFloatingInstall && (
          <div className="fixed bottom-0 inset-x-0 z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md mx-auto border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-gray-900">Install on iPhone</p>
                <button
                  onClick={() => setShowFloatingInstall(false)}
                  className="text-gray-400 text-xl"
                >
                  ×
                </button>
              </div>
              <ol className="space-y-2">
                {[
                  {
                    step: "1",
                    text: "Tap the Share button at the bottom of Safari",
                    icon: "⬆️",
                  },
                  { step: "2", text: 'Tap "Add to Home Screen"', icon: "➕" },
                  { step: "3", text: 'Tap "Add" in the top right', icon: "✅" },
                ].map(({ step, text, icon }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {step}
                    </span>
                    <span className="text-gray-700 text-sm">
                      {icon} {text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-16"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {business.logo_url ? (
          <div className="w-32 h-32 rounded-3xl overflow-hidden bg-white shadow-2xl mb-6 relative">
            <Image
              src={business.logo_url}
              alt={business.app_name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-32 h-32 rounded-3xl bg-white/20 flex items-center justify-center text-7xl shadow-2xl mb-6">
            🏢
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-2">
          {business.app_name || business.name}
        </h1>

        {business.welcome_message && (
          <p className="text-white/80 text-base max-w-xs mt-2">
            {business.welcome_message}
          </p>
        )}

        <div className="mt-12 w-full max-w-xs">
          {installed ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-2xl">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-gray-900 text-lg mb-1">
                App Installed!
              </p>
              <p className="text-gray-600 text-sm">
                Open the app from your home screen to continue.
              </p>
            </div>
          ) : isIos ? (
            <div className="bg-white rounded-3xl p-6 shadow-2xl">
              <p className="text-gray-900 font-bold text-lg text-center mb-4">
                Install on your iPhone
              </p>
              {!showIosSteps ? (
                <button
                  onClick={() => setShowIosSteps(true)}
                  className="w-full py-4 rounded-2xl font-bold text-white text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  📲 How to Install
                </button>
              ) : (
                <ol className="space-y-3">
                  {[
                    {
                      step: "1",
                      text: "Tap the Share button at the bottom of Safari",
                      icon: "⬆️",
                    },
                    {
                      step: "2",
                      text: 'Scroll down and tap "Add to Home Screen"',
                      icon: "➕",
                    },
                    {
                      step: "3",
                      text: 'Tap "Add" in the top right corner',
                      icon: "✅",
                    },
                  ].map(({ step, text, icon }) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {step}
                      </span>
                      <span className="text-gray-700 text-sm flex-1">
                        {icon} {text}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : canInstall ? (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-5 bg-white rounded-2xl font-bold text-xl shadow-2xl active:scale-95 transition disabled:opacity-70"
              style={{ color: primaryColor }}
            >
              {installing ? "Installing..." : "📲 Install App"}
            </button>
          ) : (
            <button
              disabled
              className="w-full py-5 bg-white/30 rounded-2xl font-bold text-xl text-white/70"
            >
              📲 Install App
            </button>
          )}
        </div>
      </div>

      {!installed && (
        <button
          onClick={handleSkip}
          className="mt-8 py-2 text-white/50 text-sm text-center"
        >
          Continue in browser instead
        </button>
      )}
    </div>
  );
}
