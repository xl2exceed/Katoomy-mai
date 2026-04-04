"use client";
// file: app/[slug]/addons/page.tsx
// Step in the car wash booking flow: customer selects optional add-ons
// After this page → /[slug]/book (date/time)
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  primary_color: string;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
}

export default function AddonsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [basePrice, setBasePrice] = useState(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadData = async () => {
    const supabase = createClient();
    const serviceId = sessionStorage.getItem("selectedServiceId");
    if (!serviceId) { router.push(`/${slug}/services`); return; }

    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color")
      .eq("slug", slug)
      .single();
    if (!businessData) { router.push(`/${slug}/services`); return; }
    setBusiness(businessData);

    // Get base price from price calculator
    const vehicleType = sessionStorage.getItem("selectedVehicleType") || "sedan";
    const vehicleCondition = sessionStorage.getItem("selectedVehicleCondition") || "light";

    const priceRes = await fetch("/api/carwash/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: businessData.id, serviceId, vehicleType, vehicleCondition }),
    });
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      setBasePrice(priceData.basePriceCents ?? 0);
    }

    // Get add-ons
    const { data: addonsData } = await supabase
      .from("service_addons")
      .select("id, name, description, price_cents, duration_minutes")
      .eq("business_id", businessData.id)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (addonsData) setAddons(addonsData);

    // Restore previously selected add-ons if user navigated back
    const savedAddons = sessionStorage.getItem("selectedAddonIds");
    if (savedAddons) {
      try { setSelectedAddonIds(new Set(JSON.parse(savedAddons))); } catch {}
    }

    setLoading(false);
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addonTotal = addons
    .filter((a) => selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + a.price_cents, 0);

  const handleContinue = () => {
    sessionStorage.setItem("selectedAddonIds", JSON.stringify([...selectedAddonIds]));
    router.push(`/${slug}/book`);
  };

  const color = business?.primary_color || "#3B82F6";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` }}
      >
        <Link href={`/${slug}/vehicle`} className="text-white/80 hover:text-white text-sm mb-2 block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Add-on services (optional)</p>
      </div>

      <div className="p-6 space-y-4 max-w-lg mx-auto">
        {addons.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-600">No add-ons available.</p>
          </div>
        ) : (
          addons.map((addon) => {
            const isSelected = selectedAddonIds.has(addon.id);
            return (
              <button
                key={addon.id}
                onClick={() => toggleAddon(addon.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition ${
                  isSelected
                    ? "bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                style={isSelected ? { borderColor: color } : {}}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{addon.name}</p>
                    {addon.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{addon.description}</p>
                    )}
                    {addon.duration_minutes > 0 && (
                      <p className="text-xs text-gray-400 mt-1">+{addon.duration_minutes} min</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">
                      {addon.price_cents === 0 ? "Free" : `+$${(addon.price_cents / 100).toFixed(2)}`}
                    </p>
                    <div
                      className={`mt-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ml-auto ${
                        isSelected ? "text-white" : "border-gray-300"
                      }`}
                      style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                    >
                      {isSelected && <span className="text-xs font-bold">✓</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}

        {/* Price summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
          <div className="flex justify-between text-gray-600">
            <span>Service</span>
            <span>${(basePrice / 100).toFixed(2)}</span>
          </div>
          {addonTotal > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Add-ons</span>
              <span>+${(addonTotal / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
            <span>Subtotal</span>
            <span>${((basePrice + addonTotal) / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Skip or Continue */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-xl font-semibold text-white text-lg"
            style={{ backgroundColor: color }}
          >
            {selectedAddonIds.size > 0
              ? `Continue with ${selectedAddonIds.size} add-on${selectedAddonIds.size > 1 ? "s" : ""} →`
              : "Continue without add-ons →"}
          </button>
        </div>
      </div>
    </div>
  );
}
