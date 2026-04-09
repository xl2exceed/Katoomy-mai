"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  discount_percent: number;
  is_active: boolean;
  stripe_price_id: string | null;
}

interface MemberRow {
  id: string;
  created_at: string;
  current_period_end: string;
  plan_id: string;
  customers: { full_name: string | null; phone: string };
  membership_plans: { name: string; price_cents: number };
}

const BLANK_FORM = { name: "", description: "", price: "", discount: "" };

export default function MembershipAdminPage() {
  const supabase = createClient();

  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  // Form state — null = hidden, object = add/edit mode
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null); // null = new plan
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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
      .order("created_at", { ascending: true });

    setPlans(planData || []);

    const { data: memberData } = await supabase
      .from("member_subscriptions")
      .select("id, created_at, current_period_end, plan_id, customers(full_name, phone), membership_plans(name, price_cents)")
      .eq("business_id", biz.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setMembers((memberData as unknown as MemberRow[]) || []);
    setLoading(false);
  };

  const openNewForm = () => {
    setEditingPlanId(null);
    setForm(BLANK_FORM);
    setSaveMessage("");
    setShowForm(true);
  };

  const openEditForm = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description || "",
      price: (plan.price_cents / 100).toFixed(2),
      discount: String(plan.discount_percent),
    });
    setSaveMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPlanId(null);
    setForm(BLANK_FORM);
    setSaveMessage("");
  };

  const handleSave = async () => {
    const priceCents = Math.round(parseFloat(form.price) * 100);
    const discountPercent = parseInt(form.discount);

    if (!form.name || isNaN(priceCents) || priceCents <= 0 || isNaN(discountPercent) || discountPercent < 1) {
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
        planId: editingPlanId || undefined,
        name: form.name,
        description: form.description || null,
        priceCents,
        discountPercent,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok || data.error) {
      setSaveMessage("❌ " + (data.error || "Error saving plan"));
    } else {
      setSaveMessage("✅ Plan saved!");
      setTimeout(() => { setSaveMessage(""); closeForm(); }, 1500);
      load();
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    await supabase
      .from("membership_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    load();
  };

  const totalMembers = members.length;
  const monthlyRevenue = members.reduce((sum, m) => sum + (m.membership_plans?.price_cents ?? 0), 0) / 100;

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Membership Plans</h1>
              <p className="text-gray-600 mt-1">Create and manage recurring membership plans for your customers</p>
            </div>
            <button
              onClick={openNewForm}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              + Add Plan
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalMembers}</p>
            <p className="text-sm text-gray-600 mt-1">Total Active Members</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-green-600">${monthlyRevenue.toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-1">Monthly Recurring Revenue</p>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              {editingPlanId ? "Edit Plan" : "New Membership Plan"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
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
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  placeholder="e.g., 15"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Applied to all services at booking</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Priority booking + member discounts"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {form.price && form.discount && (
              <div className="mt-4 bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 Members pay <strong>${parseFloat(form.price || "0").toFixed(2)}/month</strong> and save{" "}
                  <strong>{form.discount}%</strong> on every service.
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
              <div className="flex gap-3">
                <button
                  onClick={closeForm}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingPlanId ? "Update Plan" : "Save & Activate Plan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plans List */}
        {plans.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center mb-6">
            <p className="text-gray-500 mb-3">No membership plans yet.</p>
            <button onClick={openNewForm} className="text-blue-600 font-semibold underline text-sm">
              Create your first plan →
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {plans.map((plan) => {
              const planMemberCount = members.filter((m) => m.plan_id === plan.id).length;
              return (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                      )}
                      <div className="flex gap-5 mt-2 text-sm text-gray-600">
                        <span className="font-semibold">${(plan.price_cents / 100).toFixed(2)}/mo</span>
                        <span>{plan.discount_percent}% off services</span>
                        <span className="text-blue-600 font-medium">{planMemberCount} member{planMemberCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditForm(plan)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(plan)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          plan.is_active
                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                            : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        }`}
                      >
                        {plan.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Members */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Active Members ({totalMembers})
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
                    <th className="pb-3 font-semibold text-gray-700">Plan</th>
                    <th className="pb-3 font-semibold text-gray-700">Joined</th>
                    <th className="pb-3 font-semibold text-gray-700">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 font-medium text-gray-900">{m.customers.full_name || "Guest"}</td>
                      <td className="py-3 text-gray-600">{formatPhone(m.customers.phone)}</td>
                      <td className="py-3 text-gray-600">{m.membership_plans?.name ?? "—"}</td>
                      <td className="py-3 text-gray-600">
                        {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="py-3 text-gray-600">
                        {new Date(m.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
