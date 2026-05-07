"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { HubOffer } from "@/app/api/public/hub-offers/route";

const BUSINESSES_KEY = "katoomy:businesses";

function getSlugs(): string[] {
  try { return JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]"); } catch { return []; }
}

export default function HubOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<HubOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slugs = getSlugs();
    if (slugs.length === 0) { setLoading(false); return; }

    fetch(`/api/public/hub-offers?slugs=${slugs.join(",")}`)
      .then(r => r.json())
      .then((data: HubOffer[]) => setOffers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openBusiness = (slug: string) => {
    sessionStorage.setItem("katoomy:fromHub", "1");
    router.push(`/${slug}`);
  };

  return (
    <div className="min-h-screen bg-violet-200 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/60 flex items-center justify-center text-gray-700 text-lg hover:bg-white/80 transition"
        >
          ←
        </button>
        <div className="flex items-center gap-2.5">
          <Image src="/brand/katoomy-logo.png" alt="Katoomy" width={32} height={32} className="w-8 h-8 rounded-xl" />
          <div>
            <p className="text-violet-600 text-xs font-medium tracking-wide">Katoomy</p>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Network Offers</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          </div>
        ) : offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl mb-3">🎁</p>
            <p className="text-gray-700 font-semibold">No offers available right now</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon — businesses update their offers regularly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map(offer => {
              const color = offer.primaryColor || "#7C3AED";
              return (
                <div key={offer.id} className="bg-white rounded-2xl shadow-sm border-2 overflow-hidden" style={{ borderColor: color }}>
                  <div className="p-4">
                    {/* Business identity */}
                    <div className="flex items-center gap-3 mb-3">
                      {offer.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={offer.logoUrl} alt={offer.businessName} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm" style={{ backgroundColor: color }}>
                          {offer.businessName[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>Network Offer</p>
                        <p className="text-sm font-semibold text-gray-900">{offer.businessName}</p>
                      </div>
                    </div>

                    {/* Offer details */}
                    <h2 className="text-gray-900 text-base font-black leading-snug mb-1">{offer.title}</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-4">{offer.body}</p>

                    {/* CTA */}
                    <button
                      onClick={() => openBusiness(offer.businessSlug)}
                      className="w-full py-2.5 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform"
                      style={{ backgroundColor: color }}
                    >
                      {offer.ctaLabel} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
