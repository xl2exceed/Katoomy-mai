"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDiscountPct] = useState(0);
  const [isCarwash, setIsCarwash] = useState(false);
  const [surcharges, setSurcharges] = useState<Record<string, number>>({});
  const [vehicleType, setVehicleType] = useState<string>("");

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
        setIsCarwash(carwash);

        if (carwash) {
          // Car wash: vehicle must be selected first
          const savedVehicle = sessionStorage.getItem("selectedVehicleType") || "";
          if (!savedVehicle) {
            router.replace(`/${slug}/vehicle`);
            return;
          }
          setVehicleType(savedVehicle);

          // Fetch surcharges
          try {
            const res = await fetch(`/api/carwash/settings?businessId=${businessData.id}`);
            if (res.ok) {
              const cs = await res.json();
              if (cs?.vehicle_surcharges) setSurcharges(cs.vehicle_surcharges);
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
      }

      setLoading(false);
    };

    loadData();
  }, [slug]);

  const selectService = async (serviceId: string, adjustedPriceCents: number) => {
    sessionStorage.setItem("selectedServiceId", serviceId);
    sessionStorage.removeItem("selectedAddonIds");

    if (isCarwash) {
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
      // Barber / default flow: straight to book (date/time)
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
          href={isCarwash ? `/${slug}/vehicle` : `/${slug}`}
          className="text-white/80 hover:text-white text-sm mb-2 block"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Select a service</p>
      </div>

      {/* Services List */}
      <div className="p-6 space-y-4">
        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-600">No services available at this time.</p>
          </div>
        ) : (
          services.map((service) => {
            // For carwash: bake the vehicle surcharge into the displayed price
            const surcharge = isCarwash ? (surcharges[vehicleType] ?? 0) : 0;
            const displayPrice = service.price_cents + surcharge;

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
                        <p className="text-sm text-gray-400 line-through">${(displayPrice / 100).toFixed(2)}</p>
                        <p className="text-2xl font-bold text-gray-900">${(Math.round(displayPrice * (1 - memberDiscountPct / 100)) / 100).toFixed(2)}</p>
                        <p className="text-xs text-blue-600 font-medium">⭐ Member price</p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900">${(displayPrice / 100).toFixed(2)}</p>
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