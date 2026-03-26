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
  price_cents: number;
  discount_percent: number;
  is_active: boolean;
}

export default function MobileMembershipPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
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
      .single();

    setPlan(planData || null);

    const { data: memberData } = await supabase
      .from("member_subscriptions")
      .select("id, created_at, current_period_end, customers(full_name, phone)")
      .eq("business_id", biz.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setMembers((memberData as unknown as MemberRow[]) || []);
    setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/mobile/menu" className="text-2xl">←</Link>
          <h1 className="text-xl font-bold">Elite Membership</h1>
          <div className="w-8" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Plan Summary Card */}
          {plan ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-sm text-gray-600">
                    ${(plan.price_cents / 100).toFixed(2)}/month · {plan.discount_percent}% off all services
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <button
                onClick={handleToggleActive}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                  plan.is_active
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                {plan.is_active ? "Deactivate Plan" : "Activate Plan"}
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                To edit plan details, use{" "}
                <Link href="/admin/membership" className="text-blue-600 underline">Desktop Admin</Link>
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-gray-500 mb-3">No membership plan created yet.</p>
              <Link href="/admin/membership" className="text-blue-600 font-semibold underline text-sm">
                Set up your plan on Desktop →
              </Link>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{activeMemberCount}</p>
              <p className="text-xs text-gray-600 mt-1">Active Members</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">${monthlyRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-1">Monthly Revenue</p>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">
              Active Members ({activeMemberCount})
            </h2>
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No active members yet</p>
            ) : (
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {m.customers.full_name || "Guest"}
                      </p>
                      <p className="text-xs text-gray-500">{formatPhone(m.customers.phone)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Renews</p>
                      <p className="text-xs font-medium text-gray-700">
                        {new Date(m.current_period_end).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
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
