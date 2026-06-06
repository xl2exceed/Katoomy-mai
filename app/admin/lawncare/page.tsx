// file: app/admin/lawncare/page.tsx
// Admin settings page for the lawn care niche
// Tabs: Settings (radius, travel fee, property pricing) | Add-ons
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────

interface LawnCareSettings {
  service_radius_miles: number;
  travel_fee_enabled: boolean;
  travel_fee_type: "flat" | "per_mile";
  travel_fee_flat_cents: number;
  travel_fee_per_mile_cents: number;
  property_surcharges: Record<string, number>;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
}

interface AddonForm {
  name: string;
  description: string;
  price: string;
  duration: string;
}

// ── Constants ────────────────────────────────────────────────────

const PROPERTY_SIZES = [
  { value: "small",  label: "Small Yard",  desc: "Up to 5,000 sq ft",   icon: "🌿" },
  { value: "medium", label: "Medium Yard", desc: "5,000–15,000 sq ft",  icon: "🌳" },
  { value: "large",  label: "Large Yard",  desc: "15,000–30,000 sq ft", icon: "🏡" },
  { value: "xl",     label: "Acre+",       desc: "Over 30,000 sq ft",   icon: "🌾" },
];

const DEFAULT_SETTINGS: LawnCareSettings = {
  service_radius_miles: 25,
  travel_fee_enabled: false,
  travel_fee_type: "flat",
  travel_fee_flat_cents: 0,
  travel_fee_per_mile_cents: 0,
  property_surcharges: { small: 0, medium: 0, large: 0, xl: 0 },
};

const EMPTY_FORM: AddonForm = { name: "", description: "", price: "", duration: "" };

// ── Page ─────────────────────────────────────────────────────────

export default function LawnCareSettingsPage() {
  const [businessId, setBusinessId] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "addons">("settings");

  // Settings tab state
  const [settings, setSettings] = useState<LawnCareSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Add-ons tab state
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing: Addon | null }>({ open: false, editing: null });
  const [form, setForm] = useState<AddonForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────

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

  const loadAddons = async (bizId: string) => {
    setAddonsLoading(true);
    const res = await fetch(`/api/lawncare/addons?businessId=${bizId}&activeOnly=false`);
    if (res.ok) setAddons(await res.json());
    setAddonsLoading(false);
  };

  useEffect(() => {
    if (activeTab === "addons" && businessId) loadAddons(businessId);
  }, [activeTab, businessId]);

  // ── Settings save ─────────────────────────────────────────────

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/lawncare/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      if (new URLSearchParams(window.location.search).get("from") === "setup") {
        window.location.href = "/admin/getting-started";
        return;
      }
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("Error saving — try again");
    } finally {
      setSaving(false);
    }
  };

  const updateSurcharge = (size: string, dollars: number) => {
    setSettings((prev) => ({
      ...prev,
      property_surcharges: { ...prev.property_surcharges, [size]: Math.round(dollars * 100) },
    }));
  };

  // ── Addon CRUD ────────────────────────────────────────────────

  const openModal = (editing?: Addon) => {
    setModal({ open: true, editing: editing ?? null });
    setForm(editing ? {
      name: editing.name,
      description: editing.description ?? "",
      price: (editing.price_cents / 100).toFixed(2),
      duration: String(editing.duration_minutes),
    } : EMPTY_FORM);
  };

  const saveAddon = async () => {
    if (!form.name.trim()) return;
    setFormSaving(true);
    const res = await fetch("/api/lawncare/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: modal.editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cents: Math.round(parseFloat(form.price || "0") * 100),
        duration_minutes: parseInt(form.duration || "0"),
      }),
    });
    setFormSaving(false);
    if (res.ok) {
      setModal({ open: false, editing: null });
      loadAddons(businessId);
    }
  };

  const deleteAddon = async (id: string) => {
    if (!confirm("Delete this add-on?")) return;
    await fetch(`/api/lawncare/addons?id=${id}`, { method: "DELETE" });
    loadAddons(businessId);
  };

  const toggleActive = async (addon: Addon) => {
    await fetch("/api/lawncare/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addon, active: !addon.active }),
    });
    loadAddons(businessId);
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌿</span>
            <h1 className="text-2xl font-bold text-gray-900">Lawn Care Settings</h1>
          </div>
          <p className="text-sm text-gray-500">Configure your service area, pricing, and add-on services.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(["settings", "addons"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm capitalize transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "settings" ? "Settings" : "Add-ons"}
            </button>
          ))}
        </div>

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Service Radius */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">📍</span>
                <h2 className="text-base font-bold text-gray-900">Service Area</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">How far you&apos;re willing to travel for jobs.</p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Service Radius</span>
                  <span className="text-sm font-bold text-green-700">{settings.service_radius_miles} miles</span>
                </div>
                <input
                  type="range" min={1} max={100}
                  value={settings.service_radius_miles}
                  onChange={(e) => setSettings((p) => ({ ...p, service_radius_miles: Number(e.target.value) }))}
                  className="w-full accent-green-600"
                />
                <p className="text-xs text-gray-400 mt-1">Customers outside this radius won&apos;t be able to book online.</p>
              </div>
            </div>

            {/* Travel Fee */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">🚛</span>
                <h2 className="text-base font-bold text-gray-900">Travel Fee</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">Charge customers a fee to cover travel to their property.</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Charge a travel fee</span>
                <button
                  onClick={() => setSettings((p) => ({ ...p, travel_fee_enabled: !p.travel_fee_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${settings.travel_fee_enabled ? "bg-green-600" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${settings.travel_fee_enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {settings.travel_fee_enabled && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {settings.travel_fee_type === "flat" ? "Flat Travel Fee ($)" : "Fee Per Mile ($)"}
                    </label>
                    <input
                      type="number" step="0.01" min={0}
                      value={settings.travel_fee_type === "flat"
                        ? (settings.travel_fee_flat_cents / 100).toFixed(2)
                        : (settings.travel_fee_per_mile_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const cents = Math.round((parseFloat(e.target.value) || 0) * 100);
                        setSettings((p) => settings.travel_fee_type === "flat"
                          ? { ...p, travel_fee_flat_cents: cents }
                          : { ...p, travel_fee_per_mile_cents: cents });
                      }}
                      className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Property Surcharges */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">📐</span>
                <h2 className="text-base font-bold text-gray-900">Property Size Pricing</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">Extra charge on top of the base service price per yard size. Leave at $0 to charge the same for all sizes.</p>
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
                        type="number" min={0} step={0.01}
                        value={((settings.property_surcharges[size.value] ?? 0) / 100).toFixed(2)}
                        onChange={(e) => updateSurcharge(size.value, parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Example: base mow = $40, large yard +$20 → customer sees $60 for a large yard mow.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saveMsg && (
                <p className={`text-sm font-medium ${saveMsg.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                  {saveMsg}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Add-ons Tab ── */}
        {activeTab === "addons" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-500">
                Add optional upsells customers can select during booking — edging, fertilizing, leaf cleanup, etc.
              </p>
              <button
                onClick={() => openModal()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition flex-shrink-0"
              >
                + Add
              </button>
            </div>

            {addonsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : addons.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                No add-ons yet. Click &quot;+ Add&quot; to create your first one.
              </div>
            ) : (
              <div className="space-y-3">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className={`bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 ${!addon.active ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{addon.name}</p>
                      {addon.description && <p className="text-sm text-gray-500 mt-0.5">{addon.description}</p>}
                      <div className="flex gap-3 mt-1 text-sm text-gray-400">
                        <span>${(addon.price_cents / 100).toFixed(2)}</span>
                        {addon.duration_minutes > 0 && <span>+{addon.duration_minutes} min</span>}
                        {!addon.active && <span className="text-orange-500">Hidden</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(addon)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                      >
                        {addon.active ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => openModal(addon)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAddon(addon.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-on Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              {modal.editing ? "Edit Add-on" : "New Add-on"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Edging, Fertilizing, Leaf Cleanup"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional short description"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number" step="0.01" min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extra Time (min)</label>
                  <input
                    type="number" min={0} step={5}
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal({ open: false, editing: null })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveAddon}
                disabled={formSaving || !form.name.trim()}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-40 transition"
              >
                {formSaving ? "Saving…" : modal.editing ? "Save Changes" : "Create Add-on"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
