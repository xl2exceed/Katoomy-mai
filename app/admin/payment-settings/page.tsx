"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PaymentSettings {
  enabled: boolean;
  cashtag: string;
  fee_mode: "pass_to_customer" | "business_absorbs";
  zelle_enabled: boolean;
  zelle_phone: string;
  zelle_email: string;
}

const DEFAULT: PaymentSettings = {
  enabled: false,
  cashtag: "",
  fee_mode: "pass_to_customer",
  zelle_enabled: false,
  zelle_phone: "",
  zelle_email: "",
};

export default function PaymentSettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    setToken(session?.access_token || "");
    const res = await fetch("/api/cashapp/settings", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        setSettings({
          enabled: data.settings.enabled ?? false,
          cashtag: data.settings.cashtag ?? "",
          fee_mode: data.settings.fee_mode ?? "pass_to_customer",
          zelle_enabled: data.settings.zelle_enabled ?? false,
          zelle_phone: data.settings.zelle_phone ?? "",
          zelle_email: data.settings.zelle_email ?? "",
        });
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/cashapp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enabled: settings.enabled,
        cashtag: settings.cashtag,
        fee_mode: settings.fee_mode,
        zelle_enabled: settings.zelle_enabled,
        zelle_phone: settings.zelle_phone,
        zelle_email: settings.zelle_email,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(data.error || "Failed to save settings.");
    }
    setSaving(false);
  }

  const toggle = (key: keyof PaymentSettings) =>
    setSettings((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Configure external payment options. A $1.00 platform fee applies per transaction, billed monthly.
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Cash App Section ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Cash App Payments</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Customers can open Cash App directly from the payment page.
              </p>
            </div>
            <button
              onClick={() => toggle("enabled")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.enabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          {settings.enabled && (
            <>
              <hr className="border-gray-100" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">$Cashtag</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">$</span>
                  <input
                    type="text"
                    placeholder="yourbusiness"
                    value={settings.cashtag.replace(/^\$/, "")}
                    onChange={(e) => setSettings((p) => ({ ...p, cashtag: e.target.value.replace(/^\$/, "") }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900 bg-white"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Used to generate the payment link customers tap to open Cash App</p>
              </div>
            </>
          )}

          {/* Platform fee setting applies to ALL non-card payments — always visible */}
          <hr className="border-gray-100" />
          <div>
            <p className="font-semibold text-gray-900 mb-1 text-sm">Platform Fee ($1.00 per transaction)</p>
            <p className="text-xs text-gray-500 mb-3">Applies to cash, Cash App, Zelle, and other non-card payments.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setSettings((p) => ({ ...p, fee_mode: "pass_to_customer" }))}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                  settings.fee_mode === "pass_to_customer"
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                Customer pays
                <div className="text-xs font-normal mt-0.5 opacity-70">Added to their total</div>
              </button>
              <button
                onClick={() => setSettings((p) => ({ ...p, fee_mode: "business_absorbs" }))}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                  settings.fee_mode === "business_absorbs"
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                Business absorbs
                <div className="text-xs font-normal mt-0.5 opacity-70">Not shown to customer</div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Zelle Section ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Zelle Payments</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Customers can send payment to your Zelle phone or email.
              </p>
            </div>
            <button
              onClick={() => toggle("zelle_enabled")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.zelle_enabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.zelle_enabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          {settings.zelle_enabled && (
            <>
              <hr className="border-gray-100" />
              <p className="text-sm text-gray-500">Enter your Zelle phone number, email, or both. Customers will see whichever you provide.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Zelle Phone Number</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={settings.zelle_phone}
                  onChange={(e) => setSettings((p) => ({ ...p, zelle_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Zelle Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={settings.zelle_email}
                  onChange={(e) => setSettings((p) => ({ ...p, zelle_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                />
              </div>
            </>
          )}
        </div>

        {/* ── How it works ──────────────────────────────────── */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">How external payments work</p>
          <p>• Customer selects their payment method at checkout</p>
          <p>• They pay via Cash App, Zelle, or cash and tap "I've Paid"</p>
          <p>• Staff receive an instant notification and confirm or dispute the payment</p>
          <p>• $1.00 per confirmed transaction is billed on the 1st of each month</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-700 disabled:opacity-60 transition"
        >
          {saving ? "Saving..." : saved ? "✅ Saved!" : "Save Payment Settings"}
        </button>
      </div>
    </div>
  );
}
