"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface NotificationSettings {
  booking_confirmations: boolean;
  appointment_reminders: boolean;
  cancellation_notices: boolean;
  loyalty_updates: boolean;
  channels: string[];
}

interface LoyaltySettings {
  business_id: string;
  enabled: boolean;
  points_per_event: number;
  earn_on_completion: boolean;
  referrer_reward_points: number;
  referral_enabled?: boolean;
}

export default function SettingsPage() {
  const supabase = createClient();

  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Form state
  const [defaultBookingStatus, setDefaultBookingStatus] = useState("confirmed");
  const [businessId, setBusinessId] = useState("");
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [pointsPerAppointment, setPointsPerAppointment] = useState(10);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referrerRewardPoints, setReferrerRewardPoints] = useState(15);
  const [depositEnabled, setDepositEnabled] = useState(false);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    booking_confirmations: true,
    appointment_reminders: true,
    cancellation_notices: true,
    loyalty_updates: true,
    channels: ["email", "sms"],
  });

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

    const { data: business } = await supabase
      .from("businesses")
      .select("id, default_booking_status")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);
      const biz = business as typeof business & {
        default_booking_status?: string;
      };
      setDefaultBookingStatus(biz.default_booking_status || "confirmed");
      const { data: settingsData } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("business_id", business.id)
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
        .eq("business_id", business.id)
        .single();

      if (depositData) setDepositEnabled(depositData.enabled);

      const { data: notifData } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", business.id)
        .single();
      if (notifData) setNotifSettings(notifData as NotificationSettings);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setSaveMessage("");

    // Save booking status setting
    const updatePayload = {
      default_booking_status: defaultBookingStatus,
    } as Record<string, string>;
    await supabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId);

    console.log("🔧 SAVING SETTINGS:");
    console.log("Loyalty Enabled:", loyaltyEnabled);
    console.log("Points Per Appointment:", pointsPerAppointment);
    console.log("Referral Enabled:", referralEnabled);
    console.log("Referrer Reward Points:", referrerRewardPoints);

    const { error } = await supabase
      .from("loyalty_settings")
      .update({
        enabled: loyaltyEnabled,
        points_per_event: pointsPerAppointment,
        referral_enabled: referralEnabled,
        referrer_reward_points: referrerRewardPoints,
      })
      .eq("business_id", settings.business_id);

    await supabase
      .from("deposit_settings")
      .upsert({ business_id: businessId, enabled: depositEnabled }, { onConflict: "business_id" });

    await supabase
      .from("notification_settings")
      .upsert({ business_id: businessId, ...notifSettings }, { onConflict: "business_id" });

    setSaving(false);

    if (error) {
      setSaveMessage("❌ Error saving settings");
      console.error("Error saving:", error);
    } else {
      setSaveMessage("✅ Settings saved successfully!");
      console.log("✅ Settings saved to database");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/bookings"
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">App Settings</h1>
          <p className="text-gray-600 mt-1">Configure your business preferences</p>
        </div>

        {/* New Bookings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Bookings</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose how new bookings are handled
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">
                {defaultBookingStatus === "confirmed"
                  ? "Auto Confirm"
                  : "Manual Approval"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDefaultBookingStatus(
                    defaultBookingStatus === "confirmed"
                      ? "requested"
                      : "confirmed",
                  )
                }
                style={{
                  width: "44px",
                  height: "24px",
                  backgroundColor:
                    defaultBookingStatus === "confirmed"
                      ? "#2563eb"
                      : "#d1d5db",
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
                    left: defaultBookingStatus === "confirmed" ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "10px",
                    transition: "left 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              {defaultBookingStatus === "confirmed"
                ? "✅ Auto Confirm — Customers are confirmed instantly when they book."
                : "⏳ Manual Approval — New bookings appear in Appointments for you to accept or decline."}
            </p>
          </div>
        </div>

        {/* Deposits Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Deposits</h2>
              <p className="text-sm text-gray-600 mt-1">
                Require a deposit when customers book online
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">
                {depositEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                type="button"
                onClick={() => setDepositEnabled(!depositEnabled)}
                style={{
                  width: "44px",
                  height: "24px",
                  backgroundColor: depositEnabled ? "#2563eb" : "#d1d5db",
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
                    left: depositEnabled ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "10px",
                    transition: "left 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>
          <div className={`rounded-lg p-4 mt-4 ${depositEnabled ? "bg-blue-50" : "bg-gray-50"}`}>
            <p className="text-sm text-gray-700">
              {depositEnabled
                ? "✅ Deposits are on — customers will be charged a deposit at booking."
                : "⬜ Deposits are off — customers are not charged at booking."}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              To configure the deposit amount and type, go to{" "}
              <Link href="/admin/stripe" className="text-blue-600 underline font-medium">
                Payments Settings
              </Link>.
            </p>
          </div>
        </div>

        {/* Loyalty Program Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Loyalty Program
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Reward customers for completed appointments
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">
                {loyaltyEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                type="button"
                onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
                style={{
                  width: "44px",
                  height: "24px",
                  backgroundColor: loyaltyEnabled ? "#2563eb" : "#d1d5db",
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
                    left: loyaltyEnabled ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "10px",
                    transition: "left 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Points Per Appointment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points Per Completed Appointment
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="1"
                max="100"
                value={pointsPerAppointment}
                onChange={(e) =>
                  setPointsPerAppointment(parseInt(e.target.value) || 10)
                }
                disabled={!loyaltyEnabled}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
              <span className="text-gray-600">
                points awarded to customer when appointment is completed
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Recommended: 5-20 points per appointment
            </p>
          </div>

          {/* Example */}
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              📊 Example:
            </p>
            <p className="text-sm text-blue-800">
              Customer completes a haircut → Earns{" "}
              <strong>{pointsPerAppointment} points</strong>
            </p>
          </div>
        </div>

        {/* Referral Program Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Referral Program
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Reward customers for bringing in new clients
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">
                {referralEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                type="button"
                onClick={() => setReferralEnabled(!referralEnabled)}
                style={{
                  width: "44px",
                  height: "24px",
                  backgroundColor: referralEnabled ? "#2563eb" : "#d1d5db",
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
                    left: referralEnabled ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "10px",
                    transition: "left 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Referrer Reward Points */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points For Successful Referral
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="1"
                max="100"
                value={referrerRewardPoints}
                onChange={(e) =>
                  setReferrerRewardPoints(parseInt(e.target.value) || 15)
                }
                disabled={!referralEnabled}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
              <span className="text-gray-600">
                points awarded to referrer when their referral completes first
                appointment
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Recommended: 10-25 points per referral
            </p>
          </div>

          {/* Example */}
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-900 mb-2">
              📊 How It Works:
            </p>
            <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
              <li>Customer A shares their referral code with Customer B</li>
              <li>Customer B uses the code and books an appointment</li>
              <li>
                Customer B completes their first appointment →{" "}
                <strong>Customer B earns {pointsPerAppointment} points</strong>
              </li>
              <li>
                <strong>
                  Customer A (referrer) earns {referrerRewardPoints} bonus
                  points
                </strong>{" "}
                🎉
              </li>
            </ol>
          </div>
        </div>

        {/* Notification Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Notification Settings</h2>
          <p className="text-sm text-gray-600 mb-6">Control which notifications are sent to customers</p>

          <div className="space-y-6">
            {/* Notification Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Send Notifications For</label>
              <div className="space-y-2">
                {[
                  { key: "booking_confirmations",  label: "Booking confirmations" },
                  { key: "appointment_reminders",  label: "Appointment reminders" },
                  { key: "cancellation_notices",   label: "Cancellation notices" },
                  { key: "loyalty_updates",        label: "Loyalty updates" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <span className="text-sm text-gray-900">{label}</span>
                    <input
                      type="checkbox"
                      checked={notifSettings[key as keyof NotificationSettings] as boolean}
                      onChange={e => setNotifSettings({ ...notifSettings, [key]: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Send Via</label>
              <div className="space-y-2">
                {[
                  { key: "sms",   label: "SMS" },
                  { key: "email", label: "Email" },
                  { key: "push",  label: "Push Notifications" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <span className="text-sm text-gray-900">{label}</span>
                    <input
                      type="checkbox"
                      checked={notifSettings.channels.includes(key)}
                      onChange={() => {
                        const channels = notifSettings.channels.includes(key)
                          ? notifSettings.channels.filter(c => c !== key)
                          : [...notifSettings.channels, key];
                        setNotifSettings({ ...notifSettings, channels });
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div>
            {saveMessage && (
              <p
                className={`text-sm font-medium ${
                  saveMessage.includes("✅") ? "text-green-600" : "text-red-600"
                }`}
              >
                {saveMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>💡 Note:</strong> Changes take effect immediately for new
            appointments. Points already awarded will not be affected.
          </p>
        </div>
      </main>
    </div>
  );
}
