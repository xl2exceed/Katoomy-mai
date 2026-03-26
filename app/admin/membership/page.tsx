"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

interface MemberRow {
  id: string;
  created_at: string;
  current_period_end: string;
  customers: {
    full_name: string | null;
    phone: string;
  };
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  discount_percent: number;
  is_active: boolean;
  stripe_price_id: string | null;
}

export default function MembershipAdminPage() {
  const supabase = createClient();

  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Plan form state
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planName, setPlanName] = useState("Elite Membership");
  const [planDescription, setPlanDescription] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planDiscount, setPlanDiscount] = useState("");

  // Members
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!biz) return;
    setBusinessId(biz.id);

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("business_id", biz.id)
      .single();

    if (planData) {
      setPlan(planData);
      setPlanName(planData.name);
      setPlanDescription(planData.description || "");
      setPlanPrice((planData.price_cents / 100).toFixed(2));
      setPlanDiscount(String(planData.discount_percent));
    }

    const { data: memberData } = await supabase
      .from("member_subscriptions")
      .select("id, created_at, current_period_end, customers(full_name, phone)")
      .eq("business_id", biz.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setMembers((memberData as unknown as MemberRow[]) || []);
    setLoading(false);
  };

  const handleSavePlan = async () => {
    const priceCents = Math.round(parseFloat(planPrice) * 100);
    const discountPercent = parseInt(planDiscount);

    if (!planName || isNaN(priceCents) || priceCents <= 0 || isNaN(discountPercent)) {
      setSaveMessage("❌ Please fill in all fields correctly");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const res = await fetch("/api/memberships/create-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        name: planName,
        description: planDescription || null,
        priceCents,
        discountPercent,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok || data.error) {
      setSaveMessage("❌ " + (data.error || "Error saving plan"));
    } else {
      setSaveMessage("✅ Plan saved and activated!");
      setTimeout(() => setSaveMessage(""), 4000);
      load();
    }
  };

  const handleToggleActive = async () => {
    if (!plan) return;
    await supabase
      .from("membership_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    load();
  };

  const activeMemberCount = members.length;
  const monthlyRevenue = plan ? (activeMemberCount * plan.price_cents) / 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <Link href="/admin/bookings" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Elite Membership</h1>
          <p className="text-gray-600 mt-1">Create and manage your recurring membership plan</p>
        </div>

        {/* Stats Row */}
        {plan && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{activeMemberCount}</p>
              <p className="text-sm text-gray-600 mt-1">Active Members</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-green-600">${monthlyRevenue.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">Monthly Revenue</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className={`text-3xl font-bold ${plan.is_active ? "text-green-600" : "text-gray-400"}`}>
                {plan.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-sm text-gray-600 mt-1">Plan Status</p>
            </div>
          </div>
        )}

        {/* Plan Setup */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Membership Plan</h2>
            {plan && (
              <button
                onClick={handleToggleActive}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  plan.is_active
                    ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                }`}
              >
                {plan.is_active ? "Deactivate Plan" : "Activate Plan"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g., Elite Membership, VIP Club"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price per Month ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
                placeholder="e.g., 29.99"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={planDiscount}
                onChange={(e) => setPlanDiscount(e.target.value)}
                placeholder="e.g., 15"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Applied to all services at booking</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
              <input
                type="text"
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                placeholder="e.g., Priority booking + member discounts"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {planPrice && planDiscount && (
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 Members pay <strong>${parseFloat(planPrice || "0").toFixed(2)}/month</strong> and save{" "}
                <strong>{planDiscount}%</strong> on every service.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div>
              {saveMessage && (
                <p className={`text-sm font-medium ${saveMessage.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                  {saveMessage}
                </p>
              )}
            </div>
            <button
              onClick={handleSavePlan}
              disabled={saving}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : plan ? "Update Plan" : "Save & Activate Plan"}
            </button>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Active Members ({activeMemberCount})
          </h2>

          {members.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active members yet. Share your membership with customers!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 font-semibold text-gray-700">Customer</th>
                    <th className="pb-3 font-semibold text-gray-700">Phone</th>
                    <th className="pb-3 font-semibold text-gray-700">Joined</th>
                    <th className="pb-3 font-semibold text-gray-700">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 font-medium text-gray-900">
                        {m.customers.full_name || "Guest"}
                      </td>
                      <td className="py-3 text-gray-600">
                        {formatPhone(m.customers.phone)}
                      </td>
                      <td className="py-3 text-gray-600">
                        {new Date(m.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="py-3 text-gray-600">
                        {new Date(m.current_period_end).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
