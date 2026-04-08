"use client";
// file: app/[slug]/vehicle/page.tsx
// Step in the car wash booking flow: customer selects vehicle type + condition
// After this page → /[slug]/addons (if addons enabled) → /[slug]/book (date/time)
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  primary_color: string;
  features: Record<string, unknown>;
}

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  pricing_type: "flat" | "vehicle_based";
  vehicle_pricing: Record<string, { light?: number; heavy?: number }> | null;
}

const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan / Coupe", icon: "🚗", desc: "Standard car, 2 or 4 door" },
  { value: "suv", label: "SUV / Crossover", icon: "🚙", desc: "Sport utility vehicle" },
  { value: "truck", label: "Truck / Pickup", icon: "🛻", desc: "Full-size or mid-size pickup" },
  { value: "van", label: "Van / Minivan", icon: "🚐", desc: "Minivan or full-size van" },
  { value: "other", label: "Other", icon: "🚘", desc: "Specialty or oversized vehicle" },
] as const;

const CONDITIONS = [
  {
    value: "light",
    label: "Lightly Soiled",
    icon: "✨",
    desc: "Normal everyday dirt, recently cleaned",
  },
  {
    value: "heavy",
    label: "Heavily Soiled",
    icon: "🪣",
    desc: "Mud, pet hair, heavy grime, or long overdue",
  },
] as const;

export default function VehiclePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<string>("light");
  const [loading, setLoading] = useState(true);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [surcharges, setSurcharges] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!service) return;
    if (service.pricing_type === "vehicle_based" && selectedVehicle && service.vehicle_pricing) {
      const vp = service.vehicle_pricing;
      const typeData = vp[selectedVehicle];
      if (typeData) {
        const price = typeData[selectedCondition as "light" | "heavy"] ?? typeData["light"] ?? service.price_cents;
        setCalculatedPrice(price);
      } else {
        setCalculatedPrice(service.price_cents);
      }
    } else {
      // flat pricing — apply per-vehicle surcharge if set
      const surcharge = selectedVehicle ? (surcharges[selectedVehicle] ?? 0) : 0;
      setCalculatedPrice(service.price_cents + surcharge);
    }
  }, [selectedVehicle, selectedCondition, service, surcharges]);

  const loadData = async () => {
    const supabase = createClient();
    const serviceId = sessionStorage.getItem("selectedServiceId");
    if (!serviceId) {
      router.push(`/${slug}/services`);
      return;
    }

    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color, features")
      .eq("slug", slug)
      .single();

    if (!businessData) { router.push(`/${slug}/services`); return; }
    setBusiness(businessData);

    // Fetch carwash surcharges
    try {
      const res = await fetch(`/api/carwash/settings?businessId=${businessData.id}`);
      if (res.ok) {
        const cs = await res.json();
        if (cs?.vehicle_surcharges) setSurcharges(cs.vehicle_surcharges);
      }
    } catch { /* ignore */ }

    const { data: serviceData } = await supabase
      .from("services")
      .select("id, name, price_cents, duration_minutes, pricing_type, vehicle_pricing")
      .eq("id", serviceId)
      .single();

    if (serviceData) setService(serviceData as Service);

    // Restore previously selected vehicle if user navigated back
    const savedVehicle = sessionStorage.getItem("selectedVehicleType") || "";
    const savedCondition = sessionStorage.getItem("selectedVehicleCondition") || "light";
    setSelectedVehicle(savedVehicle);
    setSelectedCondition(savedCondition);

    setLoading(false);
  };

  const handleContinue = async () => {
    if (!selectedVehicle) return;
    sessionStorage.setItem("selectedVehicleType", selectedVehicle);
    sessionStorage.setItem("selectedVehicleCondition", selectedCondition);
    // Save final price (base + surcharge) so customer-info uses the correct amount
    if (calculatedPrice !== null) {
      sessionStorage.setItem("vehicleBasedPriceCents", String(calculatedPrice));
    }

    // Check if this business has add-ons enabled
    if (business) {
      const supabase = createClient();
      const { data: addons } = await supabase
        .from("service_addons")
        .select("id")
        .eq("business_id", business.id)
        .eq("active", true)
        .limit(1);

      if (addons && addons.length > 0) {
        router.push(`/${slug}/addons`);
      } else {
        router.push(`/${slug}/book`);
      }
    }
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
        <Link href={`/${slug}/services`} className="text-white/80 hover:text-white text-sm mb-2 block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Tell us about your vehicle</p>
      </div>

      <div className="p-6 space-y-6 max-w-lg mx-auto">
        {/* Service summary */}
        {service && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Selected service</p>
            <p className="font-semibold text-gray-900">{service.name}</p>
            {calculatedPrice !== null && (
              <p className="text-lg font-bold mt-1" style={{ color }}>
                ${(calculatedPrice / 100).toFixed(2)}
                {selectedVehicle && (service.pricing_type === "vehicle_based" || (surcharges[selectedVehicle] ?? 0) > 0) && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (based on your vehicle)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Vehicle type selection */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Type</h2>
          <div className="space-y-3">
            {VEHICLE_TYPES.map((v) => {
              const isSelected = selectedVehicle === v.value;
              // Show price for this vehicle type
              let priceLabel = "";
              if (service?.pricing_type === "vehicle_based" && service.vehicle_pricing) {
                const typeData = service.vehicle_pricing[v.value];
                if (typeData) {
                  const price = typeData[selectedCondition as "light" | "heavy"] ?? typeData["light"];
                  if (typeof price === "number") priceLabel = `$${(price / 100).toFixed(2)}`;
                }
              } else if (service) {
                const surcharge = surcharges[v.value] ?? 0;
                const total = service.price_cents + surcharge;
                priceLabel = `$${(total / 100).toFixed(2)}`;
              }
              return (
                <button
                  key={v.value}
                  onClick={() => setSelectedVehicle(v.value)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition flex items-center gap-4 ${
                    isSelected
                      ? "border-current bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  style={isSelected ? { borderColor: color } : {}}
                >
                  <span className="text-3xl">{v.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{v.label}</p>
                    <p className="text-sm text-gray-500">{v.desc}</p>
                  </div>
                  {priceLabel && (
                    <span className="font-bold text-gray-900">{priceLabel}</span>
                  )}
                  {isSelected && (
                    <span className="text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold" style={{ backgroundColor: color }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition selection */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Condition</h2>
          <div className="grid grid-cols-2 gap-3">
            {CONDITIONS.map((c) => {
              const isSelected = selectedCondition === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setSelectedCondition(c.value)}
                  className={`p-4 rounded-xl border-2 text-center transition ${
                    isSelected
                      ? "border-current bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  style={isSelected ? { borderColor: color } : {}}
                >
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <p className="font-semibold text-gray-900 text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!selectedVehicle}
          className="w-full py-4 rounded-xl font-semibold text-white text-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: selectedVehicle ? color : undefined }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
