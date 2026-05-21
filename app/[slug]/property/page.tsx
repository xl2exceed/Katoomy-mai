"use client";
// FIRST step in the lawn care booking flow: customer picks their property size
// After this page → /[slug]/services
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  primary_color: string;
}

const PROPERTY_SIZES = [
  {
    value: "small",
    label: "Small Yard",
    icon: "🌿",
    desc: "Up to 5,000 sq ft — typical city lot",
  },
  {
    value: "medium",
    label: "Medium Yard",
    icon: "🌳",
    desc: "5,000–15,000 sq ft — standard suburban lot",
  },
  {
    value: "large",
    label: "Large Yard",
    icon: "🏡",
    desc: "15,000–30,000 sq ft — large residential lot",
  },
  {
    value: "xl",
    label: "Acre+",
    icon: "🌾",
    desc: "Over 30,000 sq ft — 1 acre or more",
  },
] as const;

export default function PropertyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const fromQuickBook = searchParams.get("from") === "quick-book";

  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("businesses")
        .select("id, name, primary_color")
        .eq("slug", slug)
        .single();

      if (!data) { router.push(`/${slug}`); return; }
      setBusiness(data);

      const saved = sessionStorage.getItem("selectedPropertySize") || "";
      setSelectedSize(saved);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleContinue = () => {
    if (!selectedSize) return;
    sessionStorage.setItem("selectedPropertySize", selectedSize);

    if (fromQuickBook) {
      sessionStorage.setItem("qbEdit_propertySize", selectedSize);
      sessionStorage.removeItem("quickBookReturn");
      router.push(`/${slug}/quick-book`);
      return;
    }

    sessionStorage.setItem("lawnCareJustSelected", "1");
    sessionStorage.removeItem("selectedServiceId");
    sessionStorage.removeItem("selectedAddonIds");
    sessionStorage.removeItem("propertySurchargeApplied");
    router.push(`/${slug}/services`);
  };

  const color = business?.primary_color || "#22C55E";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: color }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
      >
        <Link href={`/${slug}`} className="text-white/80 hover:text-white text-sm mb-3 block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">What size is your yard?</p>
      </div>

      <div className="p-6 space-y-3">
        <p className="text-sm text-gray-500 mb-4">
          Select the option that best matches your property so we can give you the most accurate pricing.
        </p>

        {PROPERTY_SIZES.map((size) => {
          const selected = selectedSize === size.value;
          return (
            <button
              key={size.value}
              onClick={() => setSelectedSize(size.value)}
              className={`w-full text-left p-5 rounded-2xl border-2 transition flex items-start gap-4 ${
                selected
                  ? "border-current bg-white shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              style={selected ? { borderColor: color } : {}}
            >
              <span className="text-3xl mt-0.5">{size.icon}</span>
              <div>
                <p className="font-bold text-gray-900 text-base">{size.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{size.desc}</p>
              </div>
              {selected && (
                <span className="ml-auto text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: color }}>
                  ✓
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={handleContinue}
          disabled={!selectedSize}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg mt-6 transition disabled:opacity-40"
          style={{ backgroundColor: color }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
