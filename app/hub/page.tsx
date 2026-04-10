"use client";
// /hub — Multi-business home screen shown when a customer uses 2+ Katoomy businesses.
// Reads business slugs from localStorage, fetches public info, renders tiles.

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

export default function HubPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slugs = getSlugs();

    if (slugs.length === 0) {
      setLoading(false);
      return;
    }

    // Single business — just go straight to it
    if (slugs.length === 1) {
      sessionStorage.setItem("katoomy:fromHub", "1");
      router.replace(`/${slugs[0]}`);
      return;
    }

    fetch(`/api/public/businesses?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: BusinessInfo[]) => {
        // Keep the order they were added in
        const ordered = slugs
          .map(s => data.find(b => b.slug === s))
          .filter(Boolean) as BusinessInfo[];
        setBusinesses(ordered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const openBusiness = (slug: string) => {
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
        <p className="text-gray-400 text-sm">Scan a Katoomy QR code to add a business</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="px-6 pt-14 pb-8">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Katoomy</p>
        <h1 className="text-3xl font-bold text-white">My Businesses</h1>
      </div>

      {/* Tile Grid */}
      <div className="px-4 grid grid-cols-2 gap-4 pb-12">
        {businesses.map((b) => {
          const color = b.primary_color || "#3B82F6";
          const displayName = b.app_name || b.name;
          return (
            <button
              key={b.slug}
              onClick={() => openBusiness(b.slug)}
              className="flex flex-col items-center justify-center p-6 rounded-3xl text-white active:scale-95 transition-transform shadow-2xl min-h-[160px]"
              style={{
                background: `linear-gradient(145deg, ${color} 0%, ${color}bb 100%)`,
              }}
            >
              {b.logo_url ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 mb-3 shadow-lg flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.logo_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl mb-3 shadow-lg flex-shrink-0">
                  🏢
                </div>
              )}
              <p className="font-bold text-center text-sm leading-tight drop-shadow">
                {displayName}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}