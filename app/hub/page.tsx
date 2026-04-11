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

// ── QR Scanner using jsQR (works on iOS and Android) ───────────────────────
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
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
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* Viewfinder overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 relative">
            <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
            {/* Corner marks */}
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
              <div key={i} className={`absolute w-8 h-8 ${pos}`}>
                <div className={`absolute w-8 h-1 bg-white rounded-full ${i < 2 ? "top-0" : "bottom-0"}`} />
                <div className={`absolute h-8 w-1 bg-white rounded-full ${i % 2 === 0 ? "left-0" : "right-0"}`} />
              </div>
            ))}
          </div>
        </div>
        {error && (
          <div className="absolute bottom-8 inset-x-0 px-6">
            <p className="text-red-400 text-sm text-center bg-black/60 rounded-xl px-4 py-3">{error}</p>
          </div>
        )}
        {!error && (
          <p className="absolute bottom-8 inset-x-0 text-center text-white/60 text-sm">
            Point at a Katoomy QR code
          </p>
        )}
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

  function loadBusinesses(openAddPanel = false) {
    const slugs = getSlugs();
    if (slugs.length === 0) { setShowAdd(true); setLoading(false); return; }

    fetch(`/api/public/businesses?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: BusinessInfo[]) => {
        const ordered = slugs
          .map(s => data.find(b => b.slug === s))
          .filter(Boolean) as BusinessInfo[];
        setBusinesses(ordered);
        if (openAddPanel || slugs.length === 1) setShowAdd(true);
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
    if (!data || data.length === 0) {
      setAddError("Business not found.");
      setAdding(false);
      return;
    }
    openBusiness(slug);
  };

  const handleManualAdd = async () => {
    setAddError("");
    const slug = parseSlug(addInput);
    if (!slug) { setAddError("Enter a business URL."); return; }
    setAdding(true);
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) {
      setAddError("Business not found. Check the URL and try again.");
      setAdding(false);
      return;
    }
    openBusiness(slug);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40" />
      </div>
    );
  }

  return (
    <>
      {scanning && (
        <QRScanner
          onDetect={handleDetected}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="min-h-screen bg-gray-950 pb-12">
        {/* Header */}
        <div className="px-6 pt-14 pb-6 flex items-end justify-between">
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Katoomy</p>
            <h1 className="text-3xl font-bold text-white">My Businesses</h1>
          </div>
          {businesses.length > 0 && (
            <button
              onClick={() => { setShowAdd(v => !v); setAddError(""); setAddInput(""); }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl hover:bg-white/20 transition"
            >
              {showAdd ? "×" : "+"}
            </button>
          )}
        </div>

        {/* Add Business Panel */}
        {showAdd && (
          <div className="mx-4 mb-6 bg-white/10 rounded-2xl p-5 space-y-3">
            <p className="text-white font-bold text-sm">Add a Business</p>

            {/* Scan button — works on iOS and Android via jsQR */}
            <button
              onClick={() => setScanning(true)}
              className="w-full py-4 bg-white text-gray-900 font-bold rounded-xl text-base flex items-center justify-center gap-2 active:scale-95 transition"
            >
              📷 Scan QR Code
            </button>

            {/* Manual URL input */}
            <div>
              <p className="text-gray-400 text-xs text-center mb-3">or enter the URL manually</p>
              <input
                type="text"
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualAdd()}
                placeholder="katoomy.com/business-name"
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-gray-500 text-sm outline-none border border-white/20 focus:border-white/50"
              />
              {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
              <button
                onClick={handleManualAdd}
                disabled={!addInput.trim() || adding}
                className="mt-2 w-full py-3 bg-white/20 text-white font-semibold rounded-xl text-sm disabled:opacity-40 transition hover:bg-white/30"
              >
                {adding ? "Adding…" : "Go to Business →"}
              </button>
            </div>
          </div>
        )}

        {/* Tile Grid */}
        {businesses.length > 0 && (
          <div className="px-4 grid grid-cols-2 gap-4">
            {businesses.map((b) => {
              const color = b.primary_color || "#3B82F6";
              const displayName = b.app_name || b.name;
              return (
                <button
                  key={b.slug}
                  onClick={() => openBusiness(b.slug)}
                  className="flex flex-col items-center justify-center p-6 rounded-3xl text-white active:scale-95 transition-transform shadow-2xl min-h-[160px]"
                  style={{ background: `linear-gradient(145deg, ${color} 0%, ${color}bb 100%)` }}
                >
                  {b.logo_url ? (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 mb-3 shadow-lg flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.logo_url} alt={displayName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl mb-3 shadow-lg flex-shrink-0">
                      🏢
                    </div>
                  )}
                  <p className="font-bold text-center text-sm leading-tight drop-shadow">{displayName}</p>
                </button>
              );
            })}
          </div>
        )}

        {businesses.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center px-8 pt-20 text-center">
            <div className="text-5xl mb-4">📱</div>
            <p className="text-xl font-bold text-white mb-2">No businesses yet</p>
            <p className="text-gray-400 text-sm">Tap + to add your first business</p>
          </div>
        )}
      </div>
    </>
  );
}