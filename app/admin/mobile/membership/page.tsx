"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  discount_percent: number;
  is_active: boolean;
}

interface MemberRow {
  id: string;
  created_at: string;
  current_period_end: string;
  plan_id: string;
  customers: { full_name: string | null; phone: string };
  membership_plans: { name: string; price_cents: number };
}

export default function MobileMembershipPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
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

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("id, name, price_cents, discount_percent, is_active")
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

  const handleToggleActive = async (plan: Plan) => {
    await supabase
      .from("membership_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    load();
  };

  const totalMembers = members.length;
  const monthlyRevenue = members.reduce((sum, m) => sum + (m.membership_plans?.price_cents ?? 0), 0) / 100;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/mobile/menu" className="text-2xl">←</Link>
          <h1 className="text-xl font-bold">Memberships</h1>
          <div className="w-8" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{totalMembers}</p>
              <p className="text-xs text-gray-600 mt-1">Active Members</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">${monthlyRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-1">Monthly Revenue</p>
            </div>
          </div>

          {/* Plans */}
          {plans.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-gray-500 mb-3">No membership plans created yet.</p>
              <Link href="/admin/membership" className="text-blue-600 font-semibold underline text-sm">
                Set up plans on Desktop →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const planMemberCount = members.filter((m) => m.plan_id === plan.id).length;
                return (
                  <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-gray-900">{plan.name}</h2>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {plan.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">
                          ${(plan.price_cents / 100).toFixed(2)}/mo · {plan.discount_percent}% off · {planMemberCount} member{planMemberCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(plan)}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                        plan.is_active
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}
                    >
                      {plan.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 text-center pt-1">
                To add or edit plans, use{" "}
                <Link href="/admin/membership" className="text-blue-600 underline">Desktop Admin</Link>
              </p>
            </div>
          )}

          {/* Members List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">
              Active Members ({totalMembers})
            </h2>
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No active members yet</p>
            ) : (
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{m.customers.full_name || "Guest"}</p>
                      <p className="text-xs text-gray-500">{formatPhone(m.customers.phone)}</p>
                      <p className="text-xs text-blue-600">{m.membership_plans?.name ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Renews</p>
                      <p className="text-xs font-medium text-gray-700">
                        {new Date(m.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
