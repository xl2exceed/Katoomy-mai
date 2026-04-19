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

  // Niche / business type state
  const [niche, setNiche] = useState("barber");
  const [serviceMode, setServiceMode] = useState("in_shop");
  const [nicheSaving, setNicheSaving] = useState(false);
  const [nicheMsg, setNicheMsg] = useState("");

  // SMS template state
  const [smsTemplates, setSmsTemplates] = useState({
    reminder:        "Hi {{customer_name}}! Reminder: your {{service_name}} appointment is tomorrow at {{appt_time}}. Reply STOP to opt out.",
    cancel_customer: "Hi {{customer_name}}! Your {{appt_time}} appointment has been cancelled. Contact {{business_name}} to reschedule.",
    cancel_staff:    "Hi {{customer_name}}! Your {{service_name}} appointment on {{appt_time}} has been cancelled. Contact {{business_name}} to reschedule.",
    payment_dispute: "Hi {{customer_name}}! {{business_name}} did not receive your payment of ${{amount}}. Please send payment or visit {{pay_link}} to pay online.",
    winback:         "Hey {{customer_name}}! We miss you at {{business_name}}. Come back and book: {{booking_link}}",
    referral:        "Hi {{customer_name}}! Thanks for visiting {{business_name}}. Refer a friend and you both get a discount: {{referral_link}}",
  });
  const [smsTemplateSaving, setSmsTemplateSaving] = useState(false);
  const [smsTemplateMsg, setSmsTemplateMsg] = useState("");

  // Smart Campaigns state
  const [smartCampaigns, setSmartCampaigns] = useState({
    appt_reminder_enabled: true,
    winback_30_enabled: true,
    winback_60_enabled: true,
    winback_90_enabled: true,
    referral_post_visit_enabled: true,
    reengage_enabled: true,
  });
  const [smartCampaignSaving, setSmartCampaignSaving] = useState(false);
  const [smartCampaignMsg, setSmartCampaignMsg] = useState("");

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
      .select("id, default_booking_status, features")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);
      const biz = business as typeof business & {
        default_booking_status?: string;
      };
      setDefaultBookingStatus(biz.default_booking_status || "confirmed");
      const features = (biz as typeof biz & { features?: Record<string, string> }).features || {};
      setNiche(features.niche || "barber");
      setServiceMode(features.service_mode || "in_shop");
      let { data: settingsData } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle();

      // Auto-create defaults for new businesses that have no loyalty_settings row yet
      if (!settingsData) {
        const defaults = {
          business_id: business.id,
          enabled: true,
          points_per_event: 10,
          earn_on_completion: true,
          referral_enabled: true,
          referrer_reward_points: 15,
        };
        const { data: created } = await supabase
          .from("loyalty_settings")
          .upsert(defaults, { onConflict: "business_id" })
          .select()
          .single();
        settingsData = created;
      }

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

      const { data: tmplData } = await supabase
        .from("sms_templates")
        .select("reminder, cancel_customer, cancel_staff, payment_dispute, winback, referral")
        .eq("business_id", business.id)
        .maybeSingle();
      if (tmplData) setSmsTemplates((prev) => ({ ...prev, ...tmplData }));

      // Load smart campaign toggles
      const { data: scData } = await supabase
        .from("ai_marketing_settings")
        .select("appt_reminder_enabled, winback_30_enabled, winback_60_enabled, winback_90_enabled, referral_post_visit_enabled, reengage_enabled")
        .eq("business_id", business.id)
        .maybeSingle();
      if (scData) {
        setSmartCampaigns({
          appt_reminder_enabled: scData.appt_reminder_enabled ?? true,
          winback_30_enabled: scData.winback_30_enabled ?? true,
          winback_60_enabled: scData.winback_60_enabled ?? true,
          winback_90_enabled: scData.winback_90_enabled ?? true,
          referral_post_visit_enabled: scData.referral_post_visit_enabled ?? true,
          reengage_enabled: scData.reengage_enabled ?? true,
        });
      }
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
      .upsert({
        business_id: businessId,
        enabled: loyaltyEnabled,
        points_per_event: pointsPerAppointment,
        earn_on_completion: true,
        referral_enabled: referralEnabled,
        referrer_reward_points: referrerRewardPoints,
      }, { onConflict: "business_id" });

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

  const handleSaveNiche = async () => {
    setNicheSaving(true);
    setNicheMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const res = await fetch("/api/admin/niche-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ niche, service_mode: serviceMode }),
    });
    setNicheSaving(false);
    if (res.ok) {
      setNicheMsg("✅ Business type saved! Reload the page to see updated navigation.");
      setTimeout(() => setNicheMsg(""), 5000);
    } else {
      setNicheMsg("❌ Failed to save business type.");
    }
  };

  const handleSaveSmsTemplates = async () => {
    setSmsTemplateSaving(true);
    setSmsTemplateMsg("");
    const res = await fetch("/api/admin/sms-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smsTemplates),
    });
    setSmsTemplateSaving(false);
    if (res.ok) {
      setSmsTemplateMsg("✅ SMS templates saved!");
      setTimeout(() => setSmsTemplateMsg(""), 3000);
    } else {
      setSmsTemplateMsg("❌ Failed to save templates.");
    }
  };

  const handleSaveSmartCampaigns = async () => {
    setSmartCampaignSaving(true);
    setSmartCampaignMsg("");
    const { error } = await supabase
      .from("ai_marketing_settings")
      .upsert({ business_id: businessId, ...smartCampaigns }, { onConflict: "business_id" });
    setSmartCampaignSaving(false);
    if (error) {
      setSmartCampaignMsg("❌ Failed to save campaign settings.");
    } else {
      setSmartCampaignMsg("✅ Campaign settings saved!");
      setTimeout(() => setSmartCampaignMsg(""), 3000);
    }
  };

  if (loading) {
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

        {/* SMS Message Templates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">SMS Message Templates</h2>
          <p className="text-sm text-gray-600 mb-1">
            Customize the text messages sent to your customers. Use <code className="bg-gray-100 px-1 rounded text-xs">{"{{variable}}"}</code> placeholders — they are replaced automatically.
          </p>
          <div className="space-y-5 mt-5">
            {([
              {
                key: "reminder",
                label: "Appointment Reminder",
                hint: "Sent the day before an appointment.",
                vars: "{{customer_name}}, {{service_name}}, {{appt_time}}",
              },
              {
                key: "cancel_customer",
                label: "Cancellation (customer cancels)",
                hint: "Sent to the customer when they cancel their own booking.",
                vars: "{{customer_name}}, {{appt_time}}, {{business_name}}",
              },
              {
                key: "cancel_staff",
                label: "Cancellation (staff/admin cancels)",
                hint: "Sent to the customer when a staff member cancels their booking.",
                vars: "{{customer_name}}, {{service_name}}, {{appt_time}}, {{business_name}}",
              },
              {
                key: "payment_dispute",
                label: "Payment Dispute",
                hint: "Sent when the business marks a claimed payment as not received.",
                vars: "{{customer_name}}, {{business_name}}, {{amount}}, {{pay_link}}",
              },
              {
                key: "winback",
                label: "Win-Back (inactive customers)",
                hint: "Also editable in Growth Hub. This setting is used when no Growth Hub template is set.",
                vars: "{{customer_name}}, {{business_name}}, {{booking_link}}",
              },
              {
                key: "referral",
                label: "Referral Reminder",
                hint: "Also editable in Growth Hub. This setting is used when no Growth Hub template is set.",
                vars: "{{customer_name}}, {{business_name}}, {{referral_link}}",
              },
            ] as { key: keyof typeof smsTemplates; label: string; hint: string; vars: string }[]).map(({ key, label, hint, vars }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-800 mb-0.5">{label}</label>
                <p className="text-xs text-gray-500 mb-1">{hint}</p>
                <textarea
                  rows={3}
                  value={smsTemplates[key]}
                  onChange={(e) => setSmsTemplates({ ...smsTemplates, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                />
                <p className="text-xs text-gray-400 mt-0.5">Variables: <span className="font-mono">{vars}</span></p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-5">
            <p className={`text-sm font-medium ${smsTemplateMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
              {smsTemplateMsg}
            </p>
            <button
              onClick={handleSaveSmsTemplates}
              disabled={smsTemplateSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {smsTemplateSaving ? "Saving…" : "Save SMS Templates"}
            </button>
          </div>
        </div>

        {/* Business Type / Niche Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Business Type</h2>
          <p className="text-sm text-gray-600 mb-6">Select your business niche to unlock the right features for your industry</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => setNiche("barber")}
              className={`p-4 rounded-xl border-2 text-left transition ${
                niche === "barber"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-2xl mb-2">✂️</div>
              <div className="font-semibold text-gray-900">Barber Shop</div>
              <div className="text-xs text-gray-500 mt-1">Staff-based scheduling, haircuts, grooming services</div>
            </button>
            <button
              type="button"
              onClick={() => setNiche("carwash")}
              className={`p-4 rounded-xl border-2 text-left transition ${
                niche === "carwash"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-2xl mb-2">🚗</div>
              <div className="font-semibold text-gray-900">Car Wash / Mobile Detailer</div>
              <div className="text-xs text-gray-500 mt-1">Vehicle-based pricing, add-ons, mobile or in-shop service</div>
            </button>
          </div>

          {niche === "carwash" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "in_shop", label: "In Shop", icon: "🏪", desc: "Customers come to you" },
                  { value: "mobile", label: "Mobile", icon: "🚐", desc: "You go to the customer" },
                  { value: "hybrid", label: "Hybrid", icon: "🔄", desc: "Both options available" },
                ].map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setServiceMode(value)}
                    className={`p-3 rounded-lg border-2 text-center transition ${
                      serviceMode === value
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{icon}</div>
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className={`text-sm font-medium ${
              nicheMsg.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}>{nicheMsg}</p>
            <button
              onClick={handleSaveNiche}
              disabled={nicheSaving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {nicheSaving ? "Saving…" : "Save Business Type"}
            </button>
          </div>
        </div>

        {/* Smart Campaigns Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-bold text-gray-900">Automated Smart Campaigns</h2>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Automated text messages sent to your customers at the right time — all on autopilot.
            All campaigns are <strong>on by default</strong>. Toggle any off to disable it.
          </p>

          <div className="space-y-3">
            {([
              {
                key: "appt_reminder_enabled" as const,
                label: "Appointment Reminder",
                desc: "Sent 24 hours before each appointment to reduce no-shows.",
                icon: "⏰",
              },
              {
                key: "winback_30_enabled" as const,
                label: "Win-Back — 30 Days (Friendly Check-In)",
                desc: "Sent when a customer hasn't booked in 30 days. A friendly nudge to come back.",
                icon: "👋",
              },
              {
                key: "winback_60_enabled" as const,
                label: "Win-Back — 60 Days (Discount Offer)",
                desc: "Sent at 60 days inactive. Offers a 10% discount code to bring them back.",
                icon: "🎁",
              },
              {
                key: "winback_90_enabled" as const,
                label: "Win-Back — 90 Days (Last Chance)",
                desc: "Sent at 90 days inactive. A final personalized offer to re-engage the customer.",
                icon: "🚨",
              },
              {
                key: "referral_post_visit_enabled" as const,
                label: "Referral Nudge (After Visit)",
                desc: "Sent 3 days after a completed appointment, asking happy customers to refer friends.",
                icon: "🙌",
              },
              {
                key: "reengage_enabled" as const,
                label: "Re-Engagement Nudge",
                desc: "Sent when a customer is overdue based on their personal visit pattern (e.g. usually every 2 weeks but hasn't booked in 3).",
                icon: "📅",
              },
            ] as { key: keyof typeof smartCampaigns; label: string; desc: string; icon: string }[]).map(({ key, label, desc, icon }) => (
              <div key={key} className={`flex items-start justify-between p-4 rounded-xl border-2 transition ${
                smartCampaigns[key] ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-start gap-3 flex-1 mr-4">
                  <span className="text-xl mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${
                    smartCampaigns[key] ? "text-green-700" : "text-gray-500"
                  }`}>{smartCampaigns[key] ? "On" : "Off"}</span>
                  <button
                    type="button"
                    onClick={() => setSmartCampaigns({ ...smartCampaigns, [key]: !smartCampaigns[key] })}
                    style={{
                      width: "44px",
                      height: "24px",
                      backgroundColor: smartCampaigns[key] ? "#16a34a" : "#d1d5db",
                      borderRadius: "12px",
                      position: "relative",
                      transition: "background-color 0.2s",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: smartCampaigns[key] ? "22px" : "2px",
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
            ))}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mt-5">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Message templates for each campaign can be customized in the
              <strong> SMS Message Templates</strong> section above.
            </p>
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className={`text-sm font-medium ${
              smartCampaignMsg.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}>{smartCampaignMsg}</p>
            <button
              onClick={handleSaveSmartCampaigns}
              disabled={smartCampaignSaving}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              {smartCampaignSaving ? "Saving…" : "Save Campaign Settings"}
            </button>
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
