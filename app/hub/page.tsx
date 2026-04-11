"use client";
// /hub — Multi-business home screen.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

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

function parseSlug(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  } catch {}
  return trimmed;
}

// ── QR Scanner ───────────────────────────────────────────────────────────────
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
      if (code && code.data.includes("katoomy.com/")) {
        const slug = parseSlug(code.data);
        if (slug) { active = false; stop(); onDetect(slug); return; }
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

// ── Fake Promo Banner ────────────────────────────────────────────────────────
function PromoBanner() {
  return (
    <div className="mx-4 rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    >
      <div className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="bg-yellow-400 text-gray-900 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
            Featured
          </div>
          <div className="text-white/40 text-xs">Sponsored</div>
        </div>
        <div className="mb-4">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Now on Katoomy</p>
          <h2 className="text-white text-2xl font-black leading-tight mb-2">
            Discover Top Local<br />Businesses Near You
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Book appointments, earn rewards, and support your community — all in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {["#e74c3c", "#3498db", "#2ecc71", "#f39c12"].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs" style={{ backgroundColor: c }}>
                {["✂️", "🚗", "💅", "🏋️"][i]}
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs">Barbers · Car Washes · More</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Hub Page ────────────────────────────────────────────────────────────
export default function HubPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
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

  function loadBusinesses() {
    const slugs = getSlugs();
    if (slugs.length === 0) { setShowAdd(true); setLoading(false); return; }

    fetch(`/api/public/businesses?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: BusinessInfo[]) => {
        const ordered = slugs.map(s => data.find(b => b.slug === s)).filter(Boolean) as BusinessInfo[];
        setBusinesses(ordered);
        if (slugs.length === 1) setShowAdd(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadBusinesses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openBusiness = (slug: string) => {
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}`);
  };

  const handleDetected = async (slug: string) => {
    setScanning(false);
    setAdding(true);
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) { setAddError("Business not found."); setAdding(false); return; }
    openBusiness(slug);
  };

  const handleManualAdd = async () => {
    setAddError("");
    const slug = parseSlug(addInput);
    if (!slug) { setAddError("Enter a business URL."); return; }
    setAdding(true);
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) { setAddError("Business not found. Check the URL and try again."); setAdding(false); return; }
    openBusiness(slug);
  };

  const filtered = businesses.filter(b =>
    (b.app_name || b.name).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40" />
      </div>
    );
  }

  return (
    <>
      {scanning && <QRScanner onDetect={handleDetected} onClose={() => setScanning(false)} />}

      <div className="min-h-screen bg-gray-950 flex flex-col">

        {/* ── TOP HALF: Header + Search + Banner ── */}
        <div className="flex-none">
          {/* Header */}
          <div className="px-4 pt-12 pb-4 flex items-center justify-between">
            <div>
              <p
                className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-0.5 select-none"
                onClick={() => {
                  devTapCount.current += 1;
                  if (devTapTimer.current) clearTimeout(devTapTimer.current);
                  devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
                  if (devTapCount.current >= 7) { devTapCount.current = 0; setDevMode(v => !v); }
                }}
              >Katoomy</p>
              <h1 className="text-2xl font-black text-white">Business Hub</h1>
            </div>
            <button
              onClick={() => { setShowAdd(v => !v); setAddError(""); setAddInput(""); }}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-xl hover:bg-white/20 transition"
            >
              {showAdd ? "×" : "+"}
            </button>
          </div>

          {/* Add Business Panel */}
          {showAdd && (
            <div className="mx-4 mb-4 bg-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-white font-bold text-sm">Add a Business</p>
              <button
                onClick={() => setScanning(true)}
                className="w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition"
              >
                📷 Scan QR Code
              </button>
              <div>
                <p className="text-gray-400 text-xs text-center mb-2">or enter the URL manually</p>
                <input
                  type="text"
                  value={addInput}
                  onChange={e => setAddInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleManualAdd()}
                  placeholder="katoomy.com/business-name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-gray-500 text-sm outline-none border border-white/20 focus:border-white/50"
                />
                {addError && <p className="text-red-400 text-xs mt-1">{addError}</p>}
                <button
                  onClick={handleManualAdd}
                  disabled={!addInput.trim() || adding}
                  className="mt-2 w-full py-2.5 bg-white/20 text-white font-semibold rounded-xl text-sm disabled:opacity-40 hover:bg-white/30 transition"
                >
                  {adding ? "Adding…" : "Go to Business →"}
                </button>
              </div>
            </div>
          )}

          {/* Search bar — only shown when there are businesses */}
          {businesses.length > 0 && (
            <div className="px-4 mb-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5 border border-white/10">
                <span className="text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search businesses..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-gray-500 text-lg leading-none">×</button>
                )}
              </div>
            </div>
          )}

          {/* Promo Banner */}
          {!showAdd && businesses.length > 0 && <PromoBanner />}
        </div>

        {/* ── BOTTOM HALF: Business Tiles ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
          {businesses.length === 0 && !showAdd && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-5xl mb-4">📱</div>
              <p className="text-xl font-bold text-white mb-2">No businesses yet</p>
              <p className="text-gray-400 text-sm">Tap + to add your first business</p>
            </div>
          )}

          {filtered.length === 0 && search.length > 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No businesses match &quot;{search}&quot;</p>
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
          </div>
        </div>
      </div>
    </>
  );
}