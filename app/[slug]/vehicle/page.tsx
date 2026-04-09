"use client";
// file: app/[slug]/vehicle/page.tsx
// FIRST step in the car wash booking flow: customer picks vehicle type + condition
// No pricing shown here — prices are shown on the services page with surcharge baked in
// After this page → /[slug]/services
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  primary_color: string;
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
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<string>("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, name, primary_color")
        .eq("slug", slug)
        .single();

      if (!businessData) { router.push(`/${slug}`); return; }
      setBusiness(businessData);

      // Restore previously selected vehicle if user navigated back
      const savedVehicle = sessionStorage.getItem("selectedVehicleType") || "";
      const savedCondition = sessionStorage.getItem("selectedVehicleCondition") || "light";
      setSelectedVehicle(savedVehicle);
      setSelectedCondition(savedCondition);

      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleContinue = () => {
    if (!selectedVehicle) return;
    sessionStorage.setItem("selectedVehicleType", selectedVehicle);
    sessionStorage.setItem("selectedVehicleCondition", selectedCondition);
    // Flag that vehicle was just selected — services page consumes this once
    sessionStorage.setItem("vehicleJustSelected", "1");
    // Clear any stale service/addon selections from a previous booking
    sessionStorage.removeItem("selectedServiceId");
    sessionStorage.removeItem("selectedAddonIds");
    sessionStorage.removeItem("vehicleBasedPriceCents");
    router.push(`/${slug}/services`);
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
        <Link href={`/${slug}`} className="text-white/80 hover:text-white text-sm mb-2 block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Tell us about your vehicle</p>
      </div>

      <div className="p-6 space-y-6 max-w-lg mx-auto">
        {/* Vehicle type selection */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Type</h2>
          <div className="space-y-3">
            {VEHICLE_TYPES.map((v) => {
              const isSelected = selectedVehicle === v.value;
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
          Select a Service →
        </button>
      </div>
    </div>
  );
}
