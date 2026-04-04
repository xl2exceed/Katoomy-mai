// file: app/admin/carwash/page.tsx
// Admin settings page for the car wash / mobile detailer niche
// Sections: Service Mode | Vehicle Pricing | Add-ons | Bay Config
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CarwashSettings {
  service_mode: "mobile" | "in_shop" | "hybrid";
  max_concurrent_jobs: number;
  service_radius_miles: number | null;
  travel_fee_enabled: boolean;
  travel_fee_type: "flat" | "per_mile";
  travel_fee_flat_cents: number;
  travel_fee_per_mile_cents: number;
  bay_labels: string[];
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

const DEFAULT_SETTINGS: CarwashSettings = {
  service_mode: "in_shop",
  max_concurrent_jobs: 1,
  service_radius_miles: null,
  travel_fee_enabled: false,
  travel_fee_type: "flat",
  travel_fee_flat_cents: 0,
  travel_fee_per_mile_cents: 0,
  bay_labels: [],
};

export default function CarwashSettingsPage() {
  const [businessId, setBusinessId] = useState("");
  const [settings, setSettings] = useState<CarwashSettings>(DEFAULT_SETTINGS);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"mode" | "addons" | "bays">("mode");

  // Add-on modal state
  const [addonModal, setAddonModal] = useState<{ open: boolean; editing: Addon | null }>({ open: false, editing: null });
  const [addonForm, setAddonForm] = useState({ name: "", description: "", price: "", duration: "" });
  const [addonSaving, setAddonSaving] = useState(false);

  // Bay label input
  const [newBayLabel, setNewBayLabel] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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

    // Load carwash settings
    const res = await fetch(`/api/carwash/settings?businessId=${biz.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
    }

    // Load add-ons
    const addonsRes = await fetch(`/api/carwash/addons?businessId=${biz.id}&activeOnly=false`);
    if (addonsRes.ok) {
      const data = await addonsRes.json();
      setAddons(data);
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg("");
    const res = await fetch("/api/carwash/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg("Settings saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } else {
      setSaveMsg("Error saving settings.");
    }
  };

  const openAddonModal = (addon?: Addon) => {
    setAddonForm({
      name: addon?.name || "",
      description: addon?.description || "",
      price: addon ? (addon.price_cents / 100).toFixed(2) : "",
      duration: addon?.duration_minutes.toString() || "0",
    });
    setAddonModal({ open: true, editing: addon || null });
  };

  const closeAddonModal = () => setAddonModal({ open: false, editing: null });

  const saveAddon = async () => {
    if (!addonForm.name.trim()) return;
    setAddonSaving(true);
    const payload = {
      id: addonModal.editing?.id,
      name: addonForm.name.trim(),
      description: addonForm.description.trim() || null,
      price_cents: Math.round(parseFloat(addonForm.price || "0") * 100),
      duration_minutes: parseInt(addonForm.duration || "0"),
    };
    const res = await fetch("/api/carwash/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAddonSaving(false);
    if (res.ok) {
      closeAddonModal();
      loadData();
    }
  };

  const deleteAddon = async (id: string) => {
    if (!confirm("Delete this add-on?")) return;
    await fetch(`/api/carwash/addons?id=${id}`, { method: "DELETE" });
    loadData();
  };

  const toggleAddonActive = async (addon: Addon) => {
    await fetch("/api/carwash/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: addon.id, ...addon, active: !addon.active }),
    });
    loadData();
  };

  const addBayLabel = () => {
    if (!newBayLabel.trim()) return;
    setSettings((s) => ({ ...s, bay_labels: [...s.bay_labels, newBayLabel.trim()] }));
    setNewBayLabel("");
  };

  const removeBayLabel = (idx: number) => {
    setSettings((s) => ({ ...s, bay_labels: s.bay_labels.filter((_, i) => i !== idx) }));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Car Wash / Detailer Settings</h1>
          <p className="text-gray-500 mt-1">Configure your service mode, add-ons, and bay management.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(["mode", "addons", "bays"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm capitalize transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "mode" ? "Service Mode" : tab === "addons" ? "Add-ons" : "Bay Management"}
            </button>
          ))}
        </div>

        {/* ── Service Mode Tab ── */}
        {activeTab === "mode" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Service Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["in_shop", "mobile", "hybrid"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings((s) => ({ ...s, service_mode: mode }))}
                      className={`p-3 rounded-lg border-2 text-sm font-medium capitalize transition ${
                        settings.service_mode === mode
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {mode === "in_shop" ? "🏪 In-Shop" : mode === "mobile" ? "🚗 Mobile" : "🔄 Hybrid"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {settings.service_mode === "in_shop" && "Customers come to your location."}
                  {settings.service_mode === "mobile" && "You travel to the customer's location."}
                  {settings.service_mode === "hybrid" && "Customers can choose in-shop or mobile service."}
                </p>
              </div>

              {(settings.service_mode === "mobile" || settings.service_mode === "hybrid") && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Service Radius (miles)</label>
                    <input
                      type="number"
                      min={1}
                      value={settings.service_radius_miles ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, service_radius_miles: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="e.g. 25"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.travel_fee_enabled}
                        onChange={(e) => setSettings((s) => ({ ...s, travel_fee_enabled: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm font-semibold text-gray-700">Charge a travel fee</span>
                    </label>
                  </div>

                  {settings.travel_fee_enabled && (
                    <div className="space-y-4 pl-7">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fee Type</label>
                        <div className="flex gap-3">
                          {(["flat", "per_mile"] as const).map((ft) => (
                            <button
                              key={ft}
                              onClick={() => setSettings((s) => ({ ...s, travel_fee_type: ft }))}
                              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${
                                settings.travel_fee_type === ft
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-600"
                              }`}
                            >
                              {ft === "flat" ? "Flat fee" : "Per mile"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {settings.travel_fee_type === "flat" ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Flat Travel Fee ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={(settings.travel_fee_flat_cents / 100).toFixed(2)}
                            onChange={(e) => setSettings((s) => ({ ...s, travel_fee_flat_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fee Per Mile ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={(settings.travel_fee_per_mile_cents / 100).toFixed(2)}
                            onChange={(e) => setSettings((s) => ({ ...s, travel_fee_per_mile_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Max Concurrent Jobs</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.max_concurrent_jobs}
                  onChange={(e) => setSettings((s) => ({ ...s, max_concurrent_jobs: parseInt(e.target.value) || 1 }))}
                  className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">How many vehicles can be serviced at the same time.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              {saveMsg && <p className={`text-sm font-medium ${saveMsg.includes("Error") ? "text-red-600" : "text-green-600"}`}>{saveMsg}</p>}
            </div>
          </div>
        )}

        {/* ── Add-ons Tab ── */}
        {activeTab === "addons" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Add optional upsells customers can select during booking (wax, interior detail, etc.)</p>
              <button
                onClick={() => openAddonModal()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                + Add
              </button>
            </div>

            {addons.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                No add-ons yet. Click &quot;+ Add&quot; to create your first one.
              </div>
            ) : (
              <div className="space-y-3">
                {addons.map((addon) => (
                  <div key={addon.id} className={`bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 ${!addon.active ? "opacity-50" : ""}`}>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{addon.name}</p>
                      {addon.description && <p className="text-sm text-gray-500">{addon.description}</p>}
                      <div className="flex gap-3 mt-1 text-sm text-gray-400">
                        <span>${(addon.price_cents / 100).toFixed(2)}</span>
                        {addon.duration_minutes > 0 && <span>+{addon.duration_minutes} min</span>}
                        {!addon.active && <span className="text-orange-500">Hidden</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAddonActive(addon)} className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">
                        {addon.active ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => openAddonModal(addon)} className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">
                        Edit
                      </button>
                      <button onClick={() => deleteAddon(addon.id)} className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bay Management Tab ── */}
        {activeTab === "bays" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Name your bays so staff can assign vehicles to specific spots on the schedule.
                Leave empty to use numbered bays (Bay 1, Bay 2, etc.).
              </p>

              <div className="space-y-2">
                {settings.bay_labels.map((label, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-16">Bay {idx + 1}</span>
                    <span className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm">{label}</span>
                    <button onClick={() => removeBayLabel(idx)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={newBayLabel}
                  onChange={(e) => setNewBayLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addBayLabel()}
                  placeholder={`Bay ${settings.bay_labels.length + 1} name (e.g. "Express Bay")`}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={addBayLabel}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Add Bay
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Bay Config"}
              </button>
              {saveMsg && <p className={`text-sm font-medium ${saveMsg.includes("Error") ? "text-red-600" : "text-green-600"}`}>{saveMsg}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Add-on Modal */}
      {addonModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              {addonModal.editing ? "Edit Add-on" : "New Add-on"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={addonForm.name}
                  onChange={(e) => setAddonForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Full Interior Detail"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={addonForm.description}
                  onChange={(e) => setAddonForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional short description"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={addonForm.price}
                    onChange={(e) => setAddonForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extra time (min)</label>
                  <input
                    type="number"
                    min={0}
                    value={addonForm.duration}
                    onChange={(e) => setAddonForm((f) => ({ ...f, duration: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeAddonModal} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
              <button
                onClick={saveAddon}
                disabled={addonSaving || !addonForm.name.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {addonSaving ? "Saving..." : addonModal.editing ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
