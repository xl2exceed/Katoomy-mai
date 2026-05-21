// file: app/admin/lawncare/page.tsx
// Admin settings page for the lawn care niche
// Sections: Service Radius | Travel Fee | Property Size Pricing
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LawnCareSettings {
  service_radius_miles: number;
  travel_fee_enabled: boolean;
  travel_fee_type: "flat" | "per_mile";
  travel_fee_flat_cents: number;
  travel_fee_per_mile_cents: number;
  property_surcharges: Record<string, number>;
}

const PROPERTY_SIZES = [
  { value: "small",  label: "Small Yard",  desc: "Up to 5,000 sq ft",    icon: "🌿" },
  { value: "medium", label: "Medium Yard", desc: "5,000–15,000 sq ft",   icon: "🌳" },
  { value: "large",  label: "Large Yard",  desc: "15,000–30,000 sq ft",  icon: "🏡" },
  { value: "xl",     label: "Acre+",       desc: "Over 30,000 sq ft",    icon: "🌾" },
];

const DEFAULT_SETTINGS: LawnCareSettings = {
  service_radius_miles: 25,
  travel_fee_enabled: false,
  travel_fee_type: "flat",
  travel_fee_flat_cents: 0,
  travel_fee_per_mile_cents: 0,
  property_surcharges: { small: 0, medium: 0, large: 0, xl: 0 },
};

export default function LawnCareSettingsPage() {
  const [businessId, setBusinessId] = useState("");
  const [settings, setSettings] = useState<LawnCareSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();
      if (!biz) return;

      setBusinessId(biz.id);

      const res = await fetch(`/api/lawncare/settings?businessId=${biz.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSettings({
            service_radius_miles: data.service_radius_miles ?? 25,
            travel_fee_enabled: data.travel_fee_enabled ?? false,
            travel_fee_type: data.travel_fee_type ?? "flat",
            travel_fee_flat_cents: data.travel_fee_flat_cents ?? 0,
            travel_fee_per_mile_cents: data.travel_fee_per_mile_cents ?? 0,
            property_surcharges: data.property_surcharges ?? { small: 0, medium: 0, large: 0, xl: 0 },
          });
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateSurcharge = (size: string, dollars: number) => {
    setSettings((prev) => ({
      ...prev,
      property_surcharges: { ...prev.property_surcharges, [size]: Math.round(dollars * 100) },
    }));
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/lawncare/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg("Error saving — try again");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌿</span>
            <h1 className="text-2xl font-bold text-gray-900">Lawn Care Settings</h1>
          </div>
          <p className="text-sm text-gray-500">Configure your service area, travel fees, and per-property pricing.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
        >
          {saving ? "Saving…" : saveMsg || "Save Settings"}
        </button>
      </div>

      <div className="space-y-6">
        {/* ── Service Radius ── */}
        <Section icon="📍" title="Service Area" desc="How far you're willing to travel for jobs.">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Service Radius</span>
              <span className="text-sm font-bold text-green-700">{settings.service_radius_miles} miles</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={settings.service_radius_miles}
              onChange={(e) => setSettings((p) => ({ ...p, service_radius_miles: Number(e.target.value) }))}
              className="w-full accent-green-600"
            />
            <p className="text-xs text-gray-400 mt-1">Customers outside this radius won't be able to book online.</p>
          </div>
        </Section>

        {/* ── Travel Fee ── */}
        <Section icon="🚛" title="Travel Fee" desc="Charge customers a fee to cover travel to their property.">
          <Toggle
            label="Charge a travel fee"
            value={settings.travel_fee_enabled}
            onChange={(v) => setSettings((p) => ({ ...p, travel_fee_enabled: v }))}
          />
          {settings.travel_fee_enabled && (
            <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Fee Type</label>
                <div className="flex gap-3">
                  {(["flat", "per_mile"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSettings((p) => ({ ...p, travel_fee_type: type }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                        settings.travel_fee_type === type
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {type === "flat" ? "Flat Fee" : "Per Mile"}
                    </button>
                  ))}
                </div>
              </div>
              {settings.travel_fee_type === "flat" ? (
                <CentsInput
                  label="Flat Travel Fee"
                  cents={settings.travel_fee_flat_cents}
                  onChange={(v) => setSettings((p) => ({ ...p, travel_fee_flat_cents: v }))}
                />
              ) : (
                <CentsInput
                  label="Fee Per Mile"
                  cents={settings.travel_fee_per_mile_cents}
                  onChange={(v) => setSettings((p) => ({ ...p, travel_fee_per_mile_cents: v }))}
                />
              )}
            </div>
          )}
        </Section>

        {/* ── Property Size Upcharges ── */}
        <Section
          icon="📐"
          title="Property Size Pricing"
          desc="Add extra to the base service price based on yard size. Leave at $0 to charge the same for all sizes."
        >
          <div className="space-y-3">
            {PROPERTY_SIZES.map((size) => (
              <div key={size.value} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span>{size.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{size.label}</p>
                    <p className="text-xs text-gray-400">{size.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 w-28">
                  <span className="text-gray-500 text-sm">+$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={((settings.property_surcharges[size.value] ?? 0) / 100).toFixed(2)}
                    onChange={(e) => updateSurcharge(size.value, parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Example: base mow = $40, large yard upcharge = $20 → customer sees $60 for a large yard mow.
          </p>
        </Section>
      </div>

      {/* Bottom save */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
        >
          {saving ? "Saving…" : saveMsg || "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ icon, title, desc, children }: { icon: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">{desc}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? "bg-green-600" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function CentsInput({ label, cents, onChange }: { label: string; cents: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={(cents / 100).toFixed(2)}
          onChange={(e) => onChange(Math.round((parseFloat(e.target.value) || 0) * 100))}
          className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
}
