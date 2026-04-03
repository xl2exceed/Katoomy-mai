"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

export default function StaffServicesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/staff/login"); return; }

      const { data: staff } = await supabase
        .from("staff")
        .select("business_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staff?.business_id) { router.push("/staff/login"); return; }

      const res = await fetch(`/api/businesses/${staff.business_id}/services`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">
        ← Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Services & Prices</h1>
      <p className="text-sm text-gray-500 mb-5">View-only reference — edit services from the desktop.</p>

      <input
        type="text"
        placeholder="Search services…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4 text-base"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12">
          {services.length === 0 ? "No services found." : "No services match your search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((service) => (
            <div key={service.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-base">{service.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{service.duration_minutes} min</p>
              </div>
              <span className="text-xl font-bold text-emerald-700">
                ${(service.price_cents / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}