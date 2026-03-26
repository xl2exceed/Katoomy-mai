"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface LoyaltySettings {
  business_id: string;
  enabled: boolean;
  points_per_event: number;
  earn_on_completion: boolean;
  referrer_reward_points: number;
  referral_enabled?: boolean;
}

interface Business {
  id: string;
  default_booking_status: string;
}

// Reusable toggle component
function Toggle({
  value,
  onChange,
  color = "#2563eb",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "44px",
        height: "24px",
        backgroundColor: value ? color : "#d1d5db",
        borderRadius: "12px",
        position: "relative",
        transition: "background-color 0.2s",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: value ? "22px" : "2px",
          width: "20px",
          height: "20px",
          backgroundColor: "white",
          borderRadius: "10px",
          transition: "left 0.2s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

export default function MobileSettingsPage() {
  const supabase = createClient();

  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [pointsPerAppointment, setPointsPerAppointment] = useState(10);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referrerRewardPoints, setReferrerRewardPoints] = useState(15);
  // true = confirmed (default), false = requested (manual approval)
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [depositEnabled, setDepositEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, default_booking_status")
      .eq("owner_user_id", user.id)
      .single();

    if (businessData) {
      setBusiness(businessData);
      setAutoConfirm(businessData.default_booking_status !== "requested");

      const { data: settingsData } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("business_id", businessData.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
        setLoyaltyEnabled(settingsData.enabled);
        setPointsPerAppointment(settingsData.points_per_event);
        setReferralEnabled(settingsData.referral_enabled ?? true);
        setReferrerRewardPoints(settingsData.referrer_reward_points || 15);
      }

      const { data: depositData } = await supabase
        .from("deposit_settings")
        .select("enabled")
        .eq("business_id", businessData.id)
        .single();

      if (depositData) setDepositEnabled(depositData.enabled);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings || !business) return;

    setSaving(true);
    setSaveMessage("");

    // Save loyalty settings
    const { error: loyaltyError } = await supabase
      .from("loyalty_settings")
      .update({
        enabled: loyaltyEnabled,
        points_per_event: pointsPerAppointment,
        referral_enabled: referralEnabled,
        referrer_reward_points: referrerRewardPoints,
      })
      .eq("business_id", settings.business_id);

    // Save deposit settings
    await supabase
      .from("deposit_settings")
      .upsert({ business_id: business.id, enabled: depositEnabled }, { onConflict: "business_id" });

    // Save booking default status
    const { error: bizError } = await supabase
      .from("businesses")
      .update({
        default_booking_status: autoConfirm ? "confirmed" : "requested",
      })
      .eq("id", business.id);

    setSaving(false);

    if (loyaltyError || bizError) {
      setSaveMessage("❌ Error saving");
      console.error("Error saving:", loyaltyError || bizError);
    } else {
      setSaveMessage("✅ Saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/mobile/menu" className="text-2xl">
            ←
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Booking Default Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">New Bookings</h2>
              <p className="text-sm text-gray-600 mt-1">
                {autoConfirm
                  ? "Auto-confirmed — no approval needed"
                  : "Requires your approval before confirming"}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-700">
                {autoConfirm ? "Auto" : "Manual"}
              </span>
              <Toggle
                value={autoConfirm}
                onChange={setAutoConfirm}
                color="#2563eb"
              />
            </div>
          </div>
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${autoConfirm ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}
          >
            {autoConfirm
              ? "✅ Customers are confirmed instantly when they book"
              : "⏳ New bookings will appear in Appointments for you to accept or decline"}
          </div>
        </div>

        {/* Deposits Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Deposits</h2>
              <p className="text-sm text-gray-600 mt-1">
                Require a deposit at booking
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-700">
                {depositEnabled ? "ON" : "OFF"}
              </span>
              <Toggle value={depositEnabled} onChange={setDepositEnabled} color="#2563eb" />
            </div>
          </div>
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${depositEnabled ? "bg-blue-50 text-blue-800" : "bg-gray-50 text-gray-600"}`}>
            {depositEnabled
              ? "✅ Customers will be charged a deposit when they book online."
              : "⬜ No deposit required at booking."}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Configure deposit amount in{" "}
            <Link href="/admin/stripe" className="text-blue-600 underline">
              Payments Settings
            </Link>
          </p>
        </div>

        {/* Loyalty Program Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Loyalty Program
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Reward for appointments
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-700">
                {loyaltyEnabled ? "ON" : "OFF"}
              </span>
              <Toggle
                value={loyaltyEnabled}
                onChange={setLoyaltyEnabled}
                color="#2563eb"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points Per Appointment
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={pointsPerAppointment}
              onChange={(e) =>
                setPointsPerAppointment(parseInt(e.target.value) || 10)
              }
              disabled={!loyaltyEnabled}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-lg"
            />
            <p className="text-xs text-gray-500 mt-2">
              Recommended: 5-20 points
            </p>
          </div>
        </div>

        {/* Referral Program Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Referral Program
              </h2>
              <p className="text-sm text-gray-600 mt-1">Reward for referrals</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-700">
                {referralEnabled ? "ON" : "OFF"}
              </span>
              <Toggle
                value={referralEnabled}
                onChange={setReferralEnabled}
                color="#9333ea"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Referrer Reward Points
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={referrerRewardPoints}
              onChange={(e) =>
                setReferrerRewardPoints(parseInt(e.target.value) || 15)
              }
              disabled={!referralEnabled}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-500 text-lg"
            />
            <p className="text-xs text-gray-500 mt-2">
              Recommended: 10-25 points
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 How It Works:</strong>
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
            <li>
              Customer completes appointment → earns {pointsPerAppointment}{" "}
              points
            </li>
            <li>
              Referred customer&apos;s first appointment → referrer earns{" "}
              {referrerRewardPoints} points
            </li>
          </ul>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        {saveMessage && (
          <p
            className={`text-sm font-medium text-center mb-2 ${saveMessage.includes("✅") ? "text-green-600" : "text-red-600"}`}
          >
            {saveMessage}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
