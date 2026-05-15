"use client";
// /hub — Multi-business home screen.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import jsQR from "jsqr";
import type { HubOffer } from "@/app/api/public/hub-offers/route";
import { detectDevice, isRunningAsApp } from "@/lib/utils/detectDevice";

const INSTALL_TRACKED_KEY = "katoomy:hub-install-tracked";

interface BusinessInfo {
  slug: string;
  name: string;
  app_name: string;
  logo_url: string | null;
  primary_color: string;
}

const BUSINESSES_KEY = "katoomy:businesses";

function getSlugs(): string[] {
  try { return JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]"); } catch { return []; }
}

// Returns { slug, search } — search is the full query string (e.g. "?biz_ref=abc&via=xyz")
function parseBusinessUrl(input: string): { slug: string; search: string } {
  const trimmed = input.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : trimmed.toLowerCase();
    return { slug, search: url.search };
  } catch {}
  return { slug: trimmed.toLowerCase(), search: "" };
}

// ── QR Scanner (stays dark — it's over the camera) ───────────────────────────
function QRScanner({ onDetect, onClose }: { onDetect: (slug: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    }

    function scan() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!active || !video || !canvas) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        const raw = code.data;
        const isKatoomyUrl =
          raw.includes("katoomy.com/") ||
          raw.includes("katoomy-mai.vercel.app/") ||
          raw.includes("katoomy-new.vercel.app/") ||
          raw.includes("localhost:");
        if (isKatoomyUrl) {
          const { slug } = parseBusinessUrl(raw);
          if (slug) { active = false; stop(); onDetect(raw); return; }
        }
      }
      if (active) rafRef.current = requestAnimationFrame(scan);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scan();
        }
      } catch {
        setError("Camera access denied. Grant camera permission and try again.");
      }
    }

    start();
    return () => { active = false; stop(); };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <p className="text-white font-bold text-lg">Scan Business QR Code</p>
        <button onClick={onClose} className="text-white/60 text-3xl leading-none">×</button>
      </div>
      <div className="flex-1 relative">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 relative">
            <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
              <div key={i} className={`absolute w-8 h-8 ${pos}`}>
                <div className={`absolute w-8 h-1 bg-white rounded-full ${i < 2 ? "top-0" : "bottom-0"}`} />
                <div className={`absolute h-8 w-1 bg-white rounded-full ${i % 2 === 0 ? "left-0" : "right-0"}`} />
              </div>
            ))}
          </div>
        </div>
        {error
          ? <div className="absolute bottom-8 inset-x-0 px-6"><p className="text-red-400 text-sm text-center bg-black/60 rounded-xl px-4 py-3">{error}</p></div>
          : <p className="absolute bottom-8 inset-x-0 text-center text-white/60 text-sm">Point at a Katoomy QR code</p>
        }
      </div>
    </div>
  );
}

// ── Rotating Offer Banner ─────────────────────────────────────────────────────
function OfferBanner({ offers, onOpen }: { offers: HubOffer[]; onOpen: (slug: string) => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (offers.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % offers.length), 4000);
    return () => clearInterval(t);
  }, [offers.length]);

  if (offers.length === 0) return null;

  const offer = offers[idx];
  const color = offer.primaryColor || "#7C3AED";

  return (
    <div className="mx-4 rounded-2xl overflow-hidden shadow-sm border-2 border-violet-600 bg-gray-100">
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {offer.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.logoUrl} alt={offer.businessName} className="w-9 h-9 rounded-xl object-cover shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm" style={{ backgroundColor: color }}>
                {offer.businessName[0]}
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
                Network Offer
              </p>
              <p className="text-xs text-gray-500 font-medium">{offer.businessName}</p>
            </div>
          </div>
          {offers.length > 1 && (
            <div className="flex gap-1 pt-1">
              {offers.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ backgroundColor: i === idx ? color : "#d1d5db" }}
                />
              ))}
            </div>
          )}
        </div>
        <h2 className="text-gray-900 text-lg font-black leading-tight mb-1">{offer.title}</h2>
        <p className="text-gray-500 text-xs leading-relaxed mb-3">{offer.body}</p>
        <button
          onClick={() => onOpen(offer.businessSlug)}
          className="px-4 py-2 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
          style={{ backgroundColor: color }}
        >
          {offer.ctaLabel} →
        </button>
      </div>
    </div>
  );
}

// ── Main Hub Page ────────────────────────────────────────────────────────────
export default function HubPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [offers, setOffers] = useState<HubOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [devMode, setDevMode] = useState(false);
  const devTapCount = useRef(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadBusinesses() {
    const slugs = getSlugs();
    if (slugs.length === 0) { setLoading(false); return; }

    fetch(`/api/public/businesses?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: BusinessInfo[]) => {
        const ordered = slugs.map(s => data.find(b => b.slug === s)).filter(Boolean) as BusinessInfo[];
        setBusinesses(ordered);
        setLoading(false);
        // Fetch rotating offers — all network offers across all businesses
        fetch(`/api/public/hub-offers?all=true`)
          .then(r => r.json())
          .then((o: HubOffer[]) => setOffers(o))
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadBusinesses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track PWA install — once per device using localStorage guard
  useEffect(() => {
    function recordInstall() {
      if (localStorage.getItem(INSTALL_TRACKED_KEY)) return;
      localStorage.setItem(INSTALL_TRACKED_KEY, "1");
      const slugs = getSlugs();
      fetch("/api/hub/track-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceType: detectDevice(),
          referrerSlug: slugs[0] ?? null,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    }

    // iOS/iPadOS: detect standalone on load (user already installed)
    if (isRunningAsApp()) recordInstall();

    // Android/Chrome: fires at the moment of install
    window.addEventListener("appinstalled", recordInstall);
    return () => window.removeEventListener("appinstalled", recordInstall);
  }, []);

  const openBusiness = (slug: string) => {
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}`);
  };

  const handleDetected = async (rawUrl: string) => {
    setScanning(false);
    setAdding(true);
    const { slug, search } = parseBusinessUrl(rawUrl);
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) { setAddError("Business not found."); setAdding(false); return; }
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}${search}`);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAddError("");
    setAdding(true);
    const img = new window.Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(objUrl);
      if (!ctx) { setAdding(false); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (!code) {
        setAddError("No QR code found in that photo. Try a clearer image.");
        setAdding(false);
        return;
      }
      const raw = code.data;
      const isKatoomy =
        raw.includes("katoomy.com/") ||
        raw.includes("katoomy-mai.vercel.app/") ||
        raw.includes("katoomy-new.vercel.app/") ||
        raw.includes("localhost:");
      if (!isKatoomy) {
        setAddError("That doesn't look like a Katoomy QR code.");
        setAdding(false);
        return;
      }
      handleDetected(raw);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      setAddError("Couldn't read that image. Try again.");
      setAdding(false);
    };
    img.src = objUrl;
  };

  const handleManualAdd = async () => {
    setAddError("");
    const { slug, search } = parseBusinessUrl(addInput);
    if (!slug) { setAddError("Enter a business URL."); return; }
    setAdding(true);
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) { setAddError("Business not found. Check the URL and try again."); setAdding(false); return; }
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}${search}`);
  };

  const filtered = businesses.filter(b =>
    (b.app_name || b.name).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-violet-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-300" />
      </div>
    );
  }

  return (
    <>
      {scanning && <QRScanner onDetect={handleDetected} onClose={() => setScanning(false)} />}

      <div className="min-h-screen bg-violet-200 flex flex-col">

        {/* ── TOP HALF: Header + Search + Banner ── */}
        <div className="flex-none">
          {/* Header */}
          <div className="px-4 pt-12 pb-2 flex items-center gap-3">
            <Image
              src="/brand/katoomy-logo.png"
              alt="Katoomy"
              width={38}
              height={38}
              className="w-9 h-9 rounded-xl"
              onClick={() => {
                devTapCount.current += 1;
                if (devTapTimer.current) clearTimeout(devTapTimer.current);
                devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
                if (devTapCount.current >= 7) { devTapCount.current = 0; setDevMode(v => !v); }
              }}
            />
            <h1 className="text-2xl font-black text-violet-600 leading-tight">Katoomy</h1>
          </div>

          {/* Customer Discounts subtitle — centered */}
          {!showAdd && (
            <p className="text-sm font-bold text-gray-700 text-center tracking-wide pb-3">Customer Discounts</p>
          )}

          {/* Add Business Panel */}
          {showAdd && (
            <div className="mx-4 mb-4 bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
              {/* Close button — top right of the panel */}
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowAdd(false); setAddError(""); setAddInput(""); }}
                  className="w-8 h-8 rounded-full bg-gray-100 border-2 border-orange-500 flex items-center justify-center text-orange-500 text-xl font-bold hover:bg-orange-50 transition"
                >
                  ×
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
              <button
                onClick={() => setScanning(true)}
                className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition"
              >
                📷 Scan QR Code
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={adding}
                className="w-full py-3.5 bg-violet-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-40"
              >
                🖼️ Use Photo from Library
              </button>
              <div>
                <p className="text-gray-400 text-xs text-center mb-2">or enter the URL manually</p>
                <input
                  type="text"
                  value={addInput}
                  onChange={e => setAddInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleManualAdd()}
                  placeholder="katoomy.com/business-name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white text-gray-900 placeholder-gray-400 text-sm outline-none border border-gray-200 focus:border-gray-400"
                />
                {addError && <p className="text-red-600 text-xs mt-1">{addError}</p>}
                <button
                  onClick={handleManualAdd}
                  disabled={!addInput.trim() || adding}
                  className="mt-2 w-full py-2.5 bg-gray-900 text-white font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-gray-800 transition"
                >
                  {adding ? "Adding…" : "Go to Business →"}
                </button>
              </div>
            </div>
          )}

          {/* Rotating Offer Banner */}
          {!showAdd && offers.length > 0 && <OfferBanner offers={offers} onOpen={() => router.push("/hub/offers")} />}
        </div>

        {/* My Businesses label bar + search below it */}
        {businesses.length > 0 && !showAdd && (
          <div className="mx-4 mt-4 space-y-2.5">
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">My Businesses</span>
              <div className="flex-1 h-px bg-purple-200" />
              <span className="text-xs font-medium text-gray-400">{businesses.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-sm">
              <span className="text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search businesses..."
                className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 text-lg leading-none">×</button>
              )}
            </div>
          </div>
        )}

        {/* My Services label */}
        {businesses.length > 0 && !showAdd && (
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-bold text-gray-700 text-center tracking-wide">My Services</p>
          </div>
        )}

        {/* ── BOTTOM HALF: Business Tiles ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-8">
          {businesses.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-5xl mb-4">📱</div>
              <p className="text-xl font-bold text-gray-900 mb-2">No businesses yet</p>
              <p className="text-gray-400 text-sm">Tap the <span className="font-bold text-orange-500">+</span> button above to add your first business</p>
            </div>
          )}

          {filtered.length === 0 && search.length > 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No businesses match &quot;{search}&quot;</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {filtered.map((b) => {
              const color = b.primary_color || "#3B82F6";
              const displayName = b.app_name || b.name;
              return (
                <div key={b.slug} className="relative">
                  <button
                    onClick={() => openBusiness(b.slug)}
                    className="w-full flex flex-col items-center justify-center p-3 rounded-2xl text-white active:scale-95 transition-transform shadow-lg min-h-[110px]"
                    style={{ background: `linear-gradient(145deg, ${color} 0%, ${color}bb 100%)` }}
                  >
                    {b.logo_url ? (
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/20 mb-2 shadow-md flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.logo_url} alt={displayName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-xl mb-2 shadow-md flex-shrink-0">
                        🏢
                      </div>
                    )}
                    <p className="font-bold text-center text-xs leading-tight drop-shadow line-clamp-2">{displayName}</p>
                  </button>
                  {devMode && (
                    <button
                      onClick={() => {
                        const updated = getSlugs().filter(s => s !== b.slug);
                        localStorage.setItem(BUSINESSES_KEY, JSON.stringify(updated));
                        setBusinesses(prev => prev.filter(x => x.slug !== b.slug));
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-sm font-bold flex items-center justify-center shadow-lg z-10"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add business tile — always last */}
            {!showAdd && (
              <button
                onClick={() => { setShowAdd(true); setAddError(""); setAddInput(""); }}
                className="w-full flex flex-col items-center justify-center p-3 rounded-2xl min-h-[110px] border-2 border-dashed border-violet-400 bg-transparent active:scale-95 transition-transform"
              >
                <span className="text-3xl font-light text-violet-400 leading-none">+</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
