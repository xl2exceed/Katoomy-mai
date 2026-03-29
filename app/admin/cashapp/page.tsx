"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// DB column names: enabled, fee_mode ('pass_to_customer' | 'business_absorbs')
// We map them to friendlier local state names on load/save
interface CashAppSettings {
  enabled: boolean;
  cashtag: string;
  phone_number: string;
  qr_code_url: string | null;
  fee_mode: "pass_to_customer" | "business_absorbs";
}

const DEFAULT_SETTINGS: CashAppSettings = {
  enabled: false,
  cashtag: "",
  phone_number: "",
  qr_code_url: null,
  fee_mode: "pass_to_customer", // always default to customer pays
};

export default function AdminCashAppPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [token, setToken] = useState("");

  const [settings, setSettings] = useState<CashAppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    setToken(session?.access_token || "");
    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!biz) { setLoading(false); return; }
    setBusinessId(biz.id);
    const res = await fetch("/api/cashapp/settings", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        // Map DB row directly — field names now match
        setSettings({
          enabled: data.settings.enabled ?? false,
          cashtag: data.settings.cashtag ?? "",
          phone_number: data.settings.phone_number ?? "",
          qr_code_url: data.settings.qr_code_url ?? null,
          fee_mode: data.settings.fee_mode ?? "pass_to_customer",
        });
      }
    }
    setLoading(false);
  }

  async function handleQrUpload(file: File) {
    if (!businessId) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("qr_code", file);
    const res = await fetch("/api/cashapp/upload-qr", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok && data.url) {
      setSettings((prev) => ({ ...prev, qr_code_url: data.url }));
    } else {
      setError(data.error || "Upload failed.");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/cashapp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cashtag: settings.cashtag,
        phone_number: settings.phone_number,
        qr_code_url: settings.qr_code_url,
        fee_mode: settings.fee_mode,
        enabled: settings.enabled,
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
        <h1 className="text-2xl font-bold text-gray-900">Cash App Payments</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Allow customers to pay with Cash App. A $1.00 platform fee is charged per transaction, billed monthly.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

        {/* Enable / Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Enable Cash App Payments</p>
            <p className="text-sm text-gray-500 mt-0.5">
              When enabled, customers will see Cash App as a payment option.
            </p>
          </div>
          <button
            onClick={() => setSettings((p) => ({ ...p, enabled: !p.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {settings.enabled && (
          <>
            <hr className="border-gray-100" />

            {/* Cashtag */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Cash App Cashtag
              </label>
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
              <p className="text-xs text-gray-400 mt-1">Your Cash App username (without the $)</p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Cash App Phone Number
              </label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={settings.phone_number}
                onChange={(e) => setSettings((p) => ({ ...p, phone_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">Customers can send payment to this number manually</p>
            </div>

            {/* QR Code Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cash App QR Code
              </label>
              {settings.qr_code_url ? (
                <div className="flex items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.qr_code_url}
                    alt="Cash App QR Code"
                    className="w-32 h-32 rounded-lg border border-gray-200 object-contain bg-white"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-green-700 font-medium">✅ QR code uploaded</p>
                    <p className="text-xs text-gray-400">This will be shown to customers at checkout</p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Replace QR code
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                      <p className="text-sm text-gray-500">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl mb-2">📷</p>
                      <p className="text-sm font-semibold text-gray-700">Upload your Cash App QR code</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Open Cash App → Profile → QR code → Screenshot
                      </p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleQrUpload(file);
                  e.target.value = "";
                }}
              />
            </div>

            <hr className="border-gray-100" />

            {/* Fee Absorption */}
            <div>
              <p className="font-semibold text-gray-900 mb-1">Platform Fee ($1.00 per transaction)</p>
              <p className="text-sm text-gray-500 mb-3">
                Choose who pays the $1.00 platform fee per Cash App transaction.
                This fee is collected monthly from your account.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSettings((p) => ({ ...p, fee_mode: "pass_to_customer" }))}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                    settings.fee_mode === "pass_to_customer"
                      ? "border-green-500 bg-green-50 text-green-800"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-base mb-0.5">👤</div>
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
                  <div className="text-base mb-0.5">🏢</div>
                  Business absorbs
                  <div className="text-xs font-normal mt-0.5 opacity-70">Not shown to customer</div>
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <p className="font-semibold text-gray-700">How it works</p>
              <p>• Customers choose Cash App or Credit Card at checkout</p>
              <p>• They scan your QR code or send to your phone number</p>
              <p>• Staff taps &quot;Mark Cash App Paid&quot; to confirm receipt</p>
              <p>• $1.00 per transaction is billed to your account on the 1st of each month</p>
              <p>• No Stripe fees on Cash App payments (vs 2.9% + $0.30 for cards)</p>
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-700 disabled:opacity-60 transition"
          >
            {saving ? "Saving..." : saved ? "✅ Saved!" : "Save Cash App Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
