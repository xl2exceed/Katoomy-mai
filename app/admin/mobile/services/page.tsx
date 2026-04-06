"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  pricing_type?: "flat" | "vehicle_based";
  vehicle_pricing?: Record<string, { light?: number; heavy?: number }> | null;
  active: boolean;
}

const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "truck", label: "Truck" },
  { value: "van", label: "Van" },
  { value: "other", label: "Other" },
] as const;

export default function AdminMobileServicesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("barber");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/mobile/login"); return; }

      const { data: business } = await supabase
        .from("businesses")
        .select("id, features")
        .eq("owner_user_id", user.id)
        .single();

      if (!business?.id) { router.push("/admin/mobile/login"); return; }

      const features = (business as typeof business & { features?: Record<string, string> }).features || {};
      setNiche(features.niche || "barber");

      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, price_cents, duration_minutes, pricing_type, vehicle_pricing, active")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name");

      setServices((servicesData as Service[]) || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/admin/mobile/menu" className="text-blue-600 font-medium mb-4 block">
        ← Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {niche === "carwash" ? "🚗 Services & Pricing" : "✂️ Services & Prices"}
      </h1>
      <p className="text-sm text-gray-500 mb-5">View-only reference — edit services from the desktop.</p>

      <input
        type="text"
        placeholder="Search services…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12">
          {services.length === 0 ? "No services found." : "No services match your search."}
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((service) => (
            <div key={service.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-base">{service.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{service.duration_minutes} min</p>
                </div>
                {service.pricing_type === "vehicle_based" ? (
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    By vehicle
                  </span>
                ) : (
                  <span className="text-xl font-bold text-blue-700">
                    ${(service.price_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Vehicle pricing grid for carwash */}
              {niche === "carwash" && service.pricing_type === "vehicle_based" && service.vehicle_pricing && (
                <div className="border-t border-gray-100 px-5 pb-4">
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    <div className="text-xs font-semibold text-gray-500 py-1">Vehicle</div>
                    <div className="text-xs font-semibold text-center text-gray-500 py-1">Light</div>
                    <div className="text-xs font-semibold text-center text-gray-500 py-1">Heavy</div>
                    {VEHICLE_TYPES.map((v) => {
                      const vp = service.vehicle_pricing?.[v.value];
                      if (!vp) return null;
                      return (
                        <>
                          <div key={v.value + "-label"} className="text-sm text-gray-700 py-1.5 border-t border-gray-50">
                            {v.label}
                          </div>
                          <div key={v.value + "-light"} className="text-sm font-semibold text-center text-gray-900 py-1.5 border-t border-gray-50">
                            {vp.light != null ? `$${(vp.light / 100).toFixed(0)}` : "—"}
                          </div>
                          <div key={v.value + "-heavy"} className="text-sm font-semibold text-center text-gray-900 py-1.5 border-t border-gray-50">
                            {vp.heavy != null ? `$${(vp.heavy / 100).toFixed(0)}` : "—"}
                          </div>
                        </>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
