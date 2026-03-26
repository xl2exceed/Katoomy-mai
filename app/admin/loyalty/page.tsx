/* eslint-disable @typescript-eslint/no-explicit-any */
// file: app/admin/loyalty/page.tsx

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface LoyaltySettings {
  enabled: boolean;
  earn_on_booking: boolean;
  earn_on_completion: boolean;
  earn_on_referral: boolean;
  points_per_event: number;
  referrer_reward_points: number; // ADDED: Separate field for referral points
  threshold_points: number;
  reward_type: "discount" | "free_service" | "custom_prize";
  reward_value: string | null;
  referral_enabled: boolean; // ADDED: Toggle for referral system
}

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  total_points: number;
}

interface LedgerEntry {
  customer_id: string;
  points_delta: number;
  customers: {
    id: string;
    full_name: string | null;
    phone: string;
  };
}

export default function LoyaltyPage() {
  const [settings, setSettings] = useState<LoyaltySettings>({
    enabled: false,
    earn_on_booking: false,
    earn_on_completion: true,
    earn_on_referral: true,
    points_per_event: 10,
    referrer_reward_points: 15, // ADDED: Default 15 points for referrals
    threshold_points: 100,
    reward_type: "discount",
    reward_value: "$10 off",
    referral_enabled: true, // ADDED: Enable referrals by default
  });
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadLoyaltySettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLoyaltySettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);

      // Load loyalty settings
      const { data: loyaltyData } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("business_id", business.id)
        .single();

      if (loyaltyData) {
        setSettings({
          ...loyaltyData,
          // Ensure new fields have defaults if not in database
          referrer_reward_points: loyaltyData.referrer_reward_points || 15,
          referral_enabled: loyaltyData.referral_enabled !== false,
        } as LoyaltySettings);
      }

      // Load top customers by points
      const { data: ledgerData } = await supabase
        .from("loyalty_ledger")
        .select("customer_id, points_delta, customers(id, full_name, phone)")
        .eq("business_id", business.id);

      if (ledgerData) {
        const customerPoints = new Map<
          string,
          { customer: any; points: number }
        >();

        ledgerData.forEach((entry: LedgerEntry) => {
          const customerId = entry.customer_id;
          const existing = customerPoints.get(customerId);

          if (existing) {
            customerPoints.set(customerId, {
              customer: entry.customers,
              points: existing.points + entry.points_delta,
            });
          } else {
            customerPoints.set(customerId, {
              customer: entry.customers,
              points: entry.points_delta,
            });
          }
        });

        const sortedCustomers = Array.from(customerPoints.values())
          .map((item) => ({
            id: item.customer.id,
            full_name: item.customer.full_name,
            phone: item.customer.phone,
            total_points: item.points,
          }))
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 10);

        setTopCustomers(sortedCustomers);
      }
    }

    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!businessId) return;

    setSaving(true);

    await supabase.from("loyalty_settings").upsert({
      business_id: businessId,
      enabled: settings.enabled,
      earn_on_booking: settings.earn_on_booking,
      earn_on_completion: settings.earn_on_completion,
      earn_on_referral: settings.earn_on_referral,
      points_per_event: settings.points_per_event,
      referrer_reward_points: settings.referrer_reward_points, // ADDED: Save referrer points
      threshold_points: settings.threshold_points,
      reward_type: settings.reward_type,
      reward_value: settings.reward_value,
      referral_enabled: settings.referral_enabled, // ADDED: Save referral toggle
    });

    // Update business features
    await supabase
      .from("business_features")
      .update({ loyalty_enabled: settings.enabled })
      .eq("business_id", businessId);

    setSaving(false);
    alert("Loyalty settings saved!");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Rewards & Loyalty
            </h1>
            <p className="text-gray-600 mt-1">
              Encourage repeat visits with points and rewards
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Settings Panel */}
              <div className="lg:col-span-2 space-y-6">
                {/* Enable/Disable */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Loyalty Program
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Reward customers for repeat business
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSettings({ ...settings, enabled: !settings.enabled })
                      }
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                        settings.enabled ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                          settings.enabled ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {settings.enabled && (
                    <div className="space-y-4">
                      {/* When to award points */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Award Points When
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                            <input
                              type="checkbox"
                              checked={settings.earn_on_completion}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  earn_on_completion: e.target.checked,
                                })
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Appointment Completed
                              </p>
                              <p className="text-xs text-gray-600">
                                Customer completes their service
                              </p>
                            </div>
                          </label>

                          <label className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                            <input
                              type="checkbox"
                              checked={settings.earn_on_referral}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  earn_on_referral: e.target.checked,
                                })
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Successful Referral
                              </p>
                              <p className="text-xs text-gray-600">
                                Referred customer completes first visit
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Points per completion - UPDATED LABEL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Per Completed Appointment
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={settings.points_per_event}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              points_per_event: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Recommended: 5-20 points
                        </p>
                      </div>

                      {/* NEW: Points per referral */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points For Successful Referral (Referrer)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={settings.referrer_reward_points}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              referrer_reward_points:
                                parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Recommended: 10-25 points
                        </p>
                      </div>

                      {/* Points threshold */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points Needed For Reward
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={settings.threshold_points}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              threshold_points: parseInt(e.target.value) || 100,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Reward type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reward Type
                        </label>
                        <select
                          value={settings.reward_type}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              reward_type: e.target.value as
                                | "discount"
                                | "free_service"
                                | "custom_prize",
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="discount">Discount</option>
                          <option value="free_service">Free Service</option>
                          <option value="custom_prize">Custom Prize</option>
                        </select>
                      </div>

                      {/* Reward value */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reward Description
                        </label>
                        <input
                          type="text"
                          value={settings.reward_value || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              reward_value: e.target.value,
                            })
                          }
                          placeholder="e.g., $10 off next visit"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Preview */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm text-purple-900 font-medium mb-2">
                          Customer Preview:
                        </p>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">
                                Points Progress
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                0 / {settings.threshold_points} points
                              </p>
                            </div>
                            <span className="text-2xl">🎁</span>
                          </div>
                          <div className="mt-2">
                            <div className="bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full w-0"></div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Reward: {settings.reward_value || "No reward set"}
                          </p>
                        </div>
                      </div>

                      {/* NEW: Points breakdown info */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                          📊 Points Breakdown:
                        </p>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>
                            • Completed appointment → Customer earns{" "}
                            <strong>{settings.points_per_event} points</strong>
                          </li>
                          <li>
                            • Successful referral → Referrer earns{" "}
                            <strong>
                              {settings.referrer_reward_points} points
                            </strong>
                          </li>
                          <li>
                            • Reach {settings.threshold_points} points →{" "}
                            <strong>{settings.reward_value}</strong>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : "Save Loyalty Settings"}
                </button>
              </div>

              {/* Top Customers Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Top Customers
                  </h2>
                  {topCustomers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">⭐</div>
                      <p className="text-sm text-gray-600">
                        No loyalty activity yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topCustomers.map((customer, index) => (
                        <div
                          key={customer.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                index === 0
                                  ? "bg-yellow-100 text-yellow-700"
                                  : index === 1
                                    ? "bg-gray-200 text-gray-700"
                                    : index === 2
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {customer.full_name || customer.phone}
                              </p>
                              <p className="text-xs text-gray-500">
                                {customer.total_points} points
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
