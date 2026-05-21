"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  pricing_type?: "flat" | "vehicle_based";
}

interface Business {
  id: string;
  name: string;
  primary_color: string;
  features?: Record<string, unknown>;
}

export default function ServicesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const fromQuickBook = searchParams.get("from") === "quick-book";

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDiscountPct] = useState(0);
  const [isCarwash, setIsCarwash] = useState(false);
  const [isLawnCare, setIsLawnCare] = useState(false);
  const [hasNetOffer, setHasNetOffer] = useState(false);
  const [surcharges, setSurcharges] = useState<Record<string, number>>({});
  const [vehicleType, setVehicleType] = useState<string>("");
  const [propertySize, setPropertySize] = useState<string>("");
  const [feeMode, setFeeMode] = useState<string>("pass_to_customer");

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      // Get business and its ID
      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, name, primary_color, features")
        .eq("slug", slug)
        .single();

      if (businessData) {
        setBusiness(businessData);

        // Detect niche
        const features = businessData.features as Record<string, unknown> | null;
        const niche = (features?.niche as string) ?? "barber";
        const carwash = niche === "carwash";
        const lawnCare = niche === "lawn_care";
        setIsCarwash(carwash);
        setIsLawnCare(lawnCare);

        if (carwash) {
          // Car wash: vehicle must be selected first on every booking.
          const justSelected = sessionStorage.getItem("vehicleJustSelected");
          if (!justSelected) {
            router.replace(`/${slug}/vehicle`);
            return;
          }
          sessionStorage.removeItem("vehicleJustSelected");
          const savedVehicle = sessionStorage.getItem("selectedVehicleType") || "";
          setVehicleType(savedVehicle);

          try {
            const res = await fetch(`/api/carwash/settings?businessId=${businessData.id}`);
            if (res.ok) {
              const cs = await res.json();
              if (cs?.vehicle_surcharges) setSurcharges(cs.vehicle_surcharges);
            }
          } catch { /* ignore */ }
        }

        if (lawnCare) {
          // Lawn care: property size must be selected first on every booking.
          const justSelected = sessionStorage.getItem("lawnCareJustSelected");
          if (!justSelected) {
            router.replace(`/${slug}/property`);
            return;
          }
          sessionStorage.removeItem("lawnCareJustSelected");
          const savedSize = sessionStorage.getItem("selectedPropertySize") || "";
          setPropertySize(savedSize);

          try {
            const res = await fetch(`/api/lawncare/settings?businessId=${businessData.id}`);
            if (res.ok) {
              const ls = await res.json();
              if (ls?.property_surcharges) setSurcharges(ls.property_surcharges);
            }
          } catch { /* ignore */ }
        }

        // Get services for this business
        const { data: servicesData } = await supabase
          .from("services")
          .select("id, name, price_cents, duration_minutes, pricing_type")
          .eq("business_id", businessData.id)
          .eq("active", true)
          .order("name");

        if (servicesData) {
          setServices(servicesData as Service[]);
        }

        // Fetch fee_mode to know whether to bake platform fee into displayed price
        const { data: cashSettings } = await supabase
          .from("cashapp_settings")
          .select("fee_mode")
          .eq("business_id", businessData.id)
          .maybeSingle();
        setFeeMode(cashSettings?.fee_mode ?? "pass_to_customer");
      }

      setLoading(false);
    };

    loadData();

    // Check for a pending network offer for this business
    try {
      const raw = localStorage.getItem("katoomy:netRef");
      if (raw) {
        const parsed = JSON.parse(raw) as { businessSlug: string; ts: number };
        const ageMs = Date.now() - (parsed.ts || 0);
        if (parsed.businessSlug === slug && ageMs < 86400000) setHasNetOffer(true);
      }
    } catch { /* ignore */ }
  }, [slug]);

  const selectService = async (serviceId: string, adjustedPriceCents: number) => {
    sessionStorage.setItem("selectedServiceId", serviceId);
    sessionStorage.removeItem("selectedAddonIds");

    // Quick Book edit: save the new service details and return
    if (fromQuickBook) {
      const selected = services.find(s => s.id === serviceId);
      sessionStorage.setItem("qbEdit_serviceId", serviceId);
      sessionStorage.setItem("qbEdit_servicePriceCents", String(adjustedPriceCents));
      sessionStorage.setItem("qbEdit_serviceName", selected?.name ?? "");
      sessionStorage.setItem("qbEdit_serviceDuration", String(selected?.duration_minutes ?? 0));
      sessionStorage.removeItem("quickBookReturn");
      router.push(`/${slug}/quick-book`);
      return;
    }

    if (isCarwash || isLawnCare) {
      // Save the surcharge-adjusted price so customer-info uses the correct amount
      sessionStorage.setItem("vehicleBasedPriceCents", String(adjustedPriceCents));

      // Check if this business has add-ons
      const supabase = createClient();
      const { data: addons } = await supabase
        .from("service_addons")
        .select("id")
        .eq("business_id", business!.id)
        .eq("active", true)
        .limit(1);

      if (addons && addons.length > 0) {
        router.push(`/${slug}/addons`);
      } else {
        router.push(`/${slug}/book`);
      }
    } else {
      // Barber / default flow
      sessionStorage.removeItem("vehicleBasedPriceCents");
      sessionStorage.removeItem("addonTotalCents");
      sessionStorage.removeItem("selectedAddonIds");
      router.push(`/${slug}/book`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  const color = business?.primary_color || "#3B82F6";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)`,
        }}
      >
        <Link
          href={isCarwash ? `/${slug}/vehicle` : isLawnCare ? `/${slug}/property` : `/${slug}`}
          className="text-white/80 hover:text-white text-sm mb-2 block"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Select a service</p>
      </div>

      {/* Network offer banner */}
      {hasNetOffer && (
        <div className="mx-6 mt-4 px-4 py-3 bg-violet-50 border border-violet-300 rounded-xl flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <p className="text-violet-800 text-sm font-semibold">A partner discount will be automatically applied at checkout.</p>
        </div>
      )}

      {/* Services List */}
      <div className="p-6 space-y-4">
        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-600">No services available at this time.</p>
          </div>
        ) : (
          services.map((service) => {
            // Bake niche surcharge into the displayed price
            const surchargeKey = isCarwash ? vehicleType : isLawnCare ? propertySize : "";
            const surcharge = surchargeKey ? (surcharges[surchargeKey] ?? 0) : 0;
            const displayPrice = service.price_cents + surcharge;
            // Bake the $1 platform fee into the displayed price when customer pays it
            const platformFeeDisplay = feeMode === "pass_to_customer" ? 100 : 0;
            const customerVisiblePrice = displayPrice + platformFeeDisplay;

            return (
              <button
                key={service.id}
                onClick={() => selectService(service.id, displayPrice)}
                className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-blue-200 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {service.name}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {service.duration_minutes} minutes
                    </p>
                  </div>
                  <div className="text-right">
                    {memberDiscountPct > 0 ? (
                      <>
                        <p className="text-sm text-gray-400 line-through">${(customerVisiblePrice / 100).toFixed(2)}</p>
                        <p className="text-2xl font-bold text-gray-900">${(Math.round(customerVisiblePrice * (1 - memberDiscountPct / 100)) / 100).toFixed(2)}</p>
                        <p className="text-xs text-blue-600 font-medium">⭐ Member price</p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900">${(customerVisiblePrice / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <span className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium inline-block">
                    Select →
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}