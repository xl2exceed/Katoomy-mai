"use client";
// /hub — Multi-business home screen shown when a customer uses 2+ Katoomy businesses.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

// Parse a business slug out of whatever the user pasted:
// "katoomy.com/my-barber", "https://katoomy.com/my-barber", "my-barber" → "my-barber"
function parseSlug(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\/+$/, "");
  // If it looks like a URL, grab the last path segment
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  } catch {}
  // Otherwise treat the whole thing as the slug
  return trimmed;
}

export default function HubPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");

  function loadBusinesses() {
    const slugs = getSlugs();
    if (slugs.length === 0) { setLoading(false); return; }

    // Single business — go straight to it
    if (slugs.length === 1) {
      sessionStorage.setItem("katoomy:fromHub", "1");
      router.replace(`/${slugs[0]}`);
      return;
    }

    fetch(`/api/public/businesses?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: BusinessInfo[]) => {
        const ordered = slugs
          .map(s => data.find(b => b.slug === s))
          .filter(Boolean) as BusinessInfo[];
        setBusinesses(ordered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadBusinesses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openBusiness = (slug: string) => {
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}`);
  };

  const handleAdd = async () => {
    setAddError("");
    const slug = parseSlug(addInput);
    if (!slug) { setAddError("Enter a business URL or name."); return; }

    // Verify it exists before navigating
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) {
      setAddError("Business not found. Check the URL and try again.");
      return;
    }

    // Navigate to it inside the app — InstallGate will add it to localStorage
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-8 text-center">
        <div className="text-5xl mb-4">📱</div>
        <p className="text-xl font-bold mb-2">No businesses yet</p>
        <p className="text-gray-400 text-sm mb-8">Add a Katoomy business to get started</p>
        <AddBusinessPanel onAdd={(slug) => { sessionStorage.setItem("katoomy:fromHub", "1"); router.push(`/${slug}`); }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      {/* Header */}
      <div className="px-6 pt-14 pb-6 flex items-end justify-between">
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Katoomy</p>
          <h1 className="text-3xl font-bold text-white">My Businesses</h1>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(""); setAddInput(""); }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl hover:bg-white/20 transition"
        >
          {showAdd ? "×" : "+"}
        </button>
      </div>

      {/* Add Business Panel */}
      {showAdd && (
        <div className="mx-4 mb-4 bg-white/10 rounded-2xl p-4">
          <p className="text-white font-semibold mb-3 text-sm">Add a Business</p>
          <p className="text-gray-400 text-xs mb-3">
            Paste the business URL (e.g. katoomy.com/my-barber) or just the name at the end.
          </p>
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="katoomy.com/business-name"
            className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-gray-500 text-sm outline-none border border-white/20 focus:border-white/50"
          />
          {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
          <button
            onClick={handleAdd}
            disabled={!addInput.trim()}
            className="mt-3 w-full py-3 bg-white text-gray-900 font-bold rounded-xl text-sm disabled:opacity-40 transition"
          >
            Go to Business →
          </button>
        </div>
      )}

      {/* Tile Grid */}
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
    </div>
  );
}

function AddBusinessPanel({ onAdd }: { onAdd: (slug: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleAdd = async () => {
    setError("");
    const slug = parseSlug(input);
    if (!slug) { setError("Enter a business URL or name."); return; }
    const res = await fetch(`/api/public/businesses?slugs=${slug}`);
    const data: BusinessInfo[] = await res.json();
    if (!data || data.length === 0) { setError("Business not found. Check the URL and try again."); return; }
    onAdd(slug);
  };

  return (
    <div className="w-full max-w-xs">
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        placeholder="katoomy.com/business-name"
        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-gray-500 text-sm outline-none border border-white/20 focus:border-white/50 mb-3"
      />
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={handleAdd}
        disabled={!input.trim()}
        className="w-full py-3 bg-white text-gray-900 font-bold rounded-xl text-sm disabled:opacity-40"
      >
        Go to Business →
      </button>
    </div>
  );
}