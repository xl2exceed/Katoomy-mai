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
  const [memberDiscountPct, setMemberDiscountPct] = useState(0);
  const [isCarwash, setIsCarwash] = useState(false);

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
        setIsCarwash(niche === "carwash");

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

  const selectService = (serviceId: string) => {
    // Store selected service in sessionStorage
    sessionStorage.setItem("selectedServiceId", serviceId);
    // Clear any stale vehicle/addon selections from a previous booking
    sessionStorage.removeItem("selectedVehicleType");
    sessionStorage.removeItem("selectedVehicleCondition");
    sessionStorage.removeItem("selectedAddonIds");

    if (isCarwash) {
      // Car wash flow: vehicle selection first
      router.push(`/${slug}/vehicle`);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${
            business?.primary_color || "#3B82F6"
          } 0%, ${business?.primary_color || "#3B82F6"}DD 100%)`,
        }}
      >
        <Link
          href={`/${slug}`}
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
          services.map((service) => (
            <button
              key={service.id}
              onClick={() => selectService(service.id)}
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
                  {service.pricing_type === "vehicle_based" ? (
                    <p className="text-lg font-semibold text-gray-700">
                      Price varies by vehicle
                    </p>
                  ) : memberDiscountPct > 0 ? (
                    <>
                      <p className="text-sm text-gray-400 line-through">${(service.price_cents / 100).toFixed(2)}</p>
                      <p className="text-2xl font-bold text-gray-900">${(Math.round(service.price_cents * (1 - memberDiscountPct / 100)) / 100).toFixed(2)}</p>
                      <p className="text-xs text-blue-600 font-medium">⭐ Member price</p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">${(service.price_cents / 100).toFixed(2)}</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <span className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium inline-block">
                  {isCarwash ? "Select →" : "Select →"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
