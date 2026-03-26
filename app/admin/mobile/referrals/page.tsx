"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatPhone } from "@/lib/utils/formatPhone";

interface Referral {
  id: string;
  referral_code: string;
  status: string;
  reward_points_awarded: number;
  created_at: string;
  completed_at: string | null;
  referrer: {
    full_name: string | null;
    phone: string;
  };
  referred: {
    full_name: string | null;
    phone: string;
  };
}

export default function MobileReferralsPage() {
  const supabase = createClient();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    totalPointsAwarded: 0,
  });

  useEffect(() => {
    loadReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReferrals = async () => {
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
      const { data: referralsData } = await supabase
        .from("referrals")
        .select(
          `
          id,
          referral_code,
          status,
          reward_points_awarded,
          created_at,
          completed_at,
          referrer:referrer_customer_id(full_name, phone),
          referred:referred_customer_id(full_name, phone)
        `,
        )
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      if (referralsData) {
        setReferrals(referralsData as unknown as Referral[]);

        const total = referralsData.length;
        const pending = referralsData.filter(
          (r: { status: string }) => r.status === "pending",
        ).length;
        const completed = referralsData.filter(
          (r: { status: string }) => r.status === "completed",
        ).length;
        const totalPointsAwarded = referralsData.reduce(
          (sum: number, r: { reward_points_awarded: number | null }) =>
            sum + (r.reward_points_awarded || 0),
          0,
        );

        setStats({ total, pending, completed, totalPointsAwarded });
      }
    }

    setLoading(false);
  };

  const filteredReferrals = referrals.filter((referral) => {
    if (statusFilter !== "all" && referral.status !== statusFilter) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const referrerName = referral.referrer?.full_name?.toLowerCase() || "";
      const referredName = referral.referred?.full_name?.toLowerCase() || "";
      const referrerPhone = referral.referrer?.phone || "";
      const referredPhone = referral.referred?.phone || "";

      return (
        referrerName.includes(query) ||
        referredName.includes(query) ||
        referrerPhone.includes(query) ||
        referredPhone.includes(query) ||
        referral.referral_code.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link
        href="/admin/mobile/menu"
        className="text-blue-600 hover:text-blue-700 font-medium mb-4 block"
      >
        ← Back to Menu
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">Referrals</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Points</p>
          <p className="text-2xl font-bold text-blue-600">
            {stats.totalPointsAwarded}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 text-base"
        />
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 text-base"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Referrals List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-3">🎁</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No referrals yet
          </h3>
          <p className="text-gray-600 text-sm">
            {statusFilter !== "all"
              ? `No ${statusFilter} referrals found`
              : "Referrals will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReferrals.map((referral) => (
            <div
              key={referral.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              {/* Header with Status */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold text-blue-600">
                  {referral.referral_code}
                </span>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                    referral.status,
                  )}`}
                >
                  {referral.status}
                </span>
              </div>

              {/* Referrer */}
              <div className="mb-3 pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Referrer</p>
                <p className="font-semibold text-gray-900">
                  {referral.referrer?.full_name || "Unknown"}
                </p>
                <p className="text-sm text-gray-600">
                  {formatPhone(referral.referrer?.phone || "")}
                </p>
              </div>

              {/* Referred Customer */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Referred Customer</p>
                <p className="font-semibold text-gray-900">
                  {referral.referred?.full_name || "Unknown"}
                </p>
                <p className="text-sm text-gray-600">
                  {formatPhone(referral.referred?.phone || "")}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <span>Created: {formatDate(referral.created_at)}</span>
                  {referral.completed_at && (
                    <div className="text-green-600 mt-1">
                      Completed: {formatDate(referral.completed_at)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    {referral.reward_points_awarded || 0} pts
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
