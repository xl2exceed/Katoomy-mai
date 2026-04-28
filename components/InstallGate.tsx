"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
const BUSINESSES_KEY = "katoomy:businesses";

function saveLastBusiness(slug: string) {
  try { localStorage.setItem(LAST_BUSINESS_KEY, slug); } catch {}
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `katoomy_lastBusiness=${encodeURIComponent(slug)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

function getBusinessSlugs(): string[] {
  try { return JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]"); } catch { return []; }
}

function addBusinessSlug(slug: string): string[] {
  const list = getBusinessSlugs();
  if (!list.includes(slug)) {
    list.push(slug);
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list));
  }
  return list;
}

function recordInstall(slug: string) {
  const flagKey = `katoomy:installRecorded:${slug}`;
  if (localStorage.getItem(flagKey)) return;
  localStorage.setItem(flagKey, "1");
  fetch("/api/pwa/installed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}

export default function InstallGate({ business, slug, children }: InstallGateProps) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [showFloatingInstall, setShowFloatingInstall] = useState(false);

  // All browser-API-dependent state starts as null/false.
  // useEffect sets the real values. We render nothing until ready
  // to avoid SSR hydration mismatches causing doubled content.
  const [ready, setReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    // iPadOS 13+ reports as Macintosh — detect via touch support fallback
    const isIpadOS = ua.includes("macintosh") && navigator.maxTouchPoints > 1;
    return (/iphone|ipad|ipod/.test(ua) || isIpadOS) && !ua.includes("chrome");
  }, []);

  useEffect(() => {
    saveLastBusiness(slug);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    setIsStandalone(standalone);

    const allBusinesses = addBusinessSlug(slug);
    const hasOtherBusinesses = allBusinesses.filter(s => s !== slug).length > 0;
    const shouldSkip = localStorage.getItem(SKIP_KEY) === "1" || hasOtherBusinesses;
    setSkipped(shouldSkip);

    if (standalone) {
      recordInstall(slug);

      // Hub redirect: 2+ businesses and not navigating here from the hub
      if (allBusinesses.length >= 2) {
        const fromHub = sessionStorage.getItem("katoomy:fromHub");
        sessionStorage.removeItem("katoomy:fromHub");
        if (!fromHub) {
          window.location.replace("/hub");
          return; // don't set ready — page is being replaced
        }
      }
    }

    setReady(true);

    // Android / Chrome: fires after user accepts install prompt
    const onInstalled = () => recordInstall(slug);
    window.addEventListener("appinstalled", onInstalled);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      setShowFloatingInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
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

  // Render nothing until useEffect has run — prevents SSR/client mismatch
  if (!ready) return null;

  // Standalone (PWA) or already past the gate
  if (isStandalone || skipped) {
    return (
      <>
        {children}
        {!isStandalone && canInstall && (
          <button
            onClick={handleInstall}
            className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl"
            style={{ backgroundColor: primaryColor }}
          >
            📲 Install App
          </button>
        )}
        {!isStandalone && isIos && showFloatingInstall && (
          <div className="fixed bottom-0 inset-x-0 z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md mx-auto border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-gray-900">Install on iPhone / iPad</p>
                <button onClick={() => setShowFloatingInstall(false)} className="text-gray-400 text-xl">×</button>
              </div>
              <ol className="space-y-2">
                {[
                  { step: "1", text: "Tap the Share button in Safari", icon: "share" },
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
                    <span className="text-gray-700 text-sm flex items-center gap-1">
                      {icon === "share" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="11" rx="2" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                          <polyline points="9 5 12 2 15 5" />
                        </svg>
                      ) : icon} {text}
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

  // Install gate — shown only for the first Katoomy business in browser
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-16"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {business.logo_url ? (
          <div className="w-32 h-32 rounded-3xl overflow-hidden bg-white shadow-2xl mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={business.logo_url} alt={business.app_name} className="w-full h-full object-cover" />
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
          <p className="text-white/80 text-base max-w-xs mt-2">{business.welcome_message}</p>
        )}

        <div className="mt-12 w-full max-w-xs">
          {installed ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-2xl">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-gray-900 text-lg mb-1">App Installed!</p>
              <p className="text-gray-600 text-sm">Open the app from your home screen to continue.</p>
            </div>
          ) : isIos ? (
            <div className="bg-white rounded-3xl p-6 shadow-2xl">
              <p className="text-gray-900 font-bold text-lg text-center mb-4">Install on your iPhone</p>
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
                    { step: "1", text: "Tap the Share button in Safari", icon: "share" },
                    { step: "2", text: 'Scroll down and tap "Add to Home Screen"', icon: "➕" },
                    { step: "3", text: 'Tap "Add" in the top right corner', icon: "✅" },
                  ].map(({ step, text, icon }) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {step}
                      </span>
                      <span className="text-gray-700 text-sm flex-1 flex items-center gap-1">
                        {icon === "share" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="11" width="14" height="11" rx="2" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                            <polyline points="9 5 12 2 15 5" />
                          </svg>
                        ) : icon} {text}
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
            <button disabled className="w-full py-5 bg-white/30 rounded-2xl font-bold text-xl text-white/70">
              📲 Install App
            </button>
          )}
        </div>
      </div>

      {!installed && (
        <button onClick={handleSkip} className="mt-8 py-2 text-white/50 text-sm text-center">
          Continue in browser instead
        </button>
      )}
    </div>
  );
}
