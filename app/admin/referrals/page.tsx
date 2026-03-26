"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function ReferralsPage() {
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
      // Get all referrals with customer details
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
        console.log("📊 Referrals data:", referralsData);
        console.log("📊 Length:", referralsData.length);

        setReferrals(referralsData as unknown as Referral[]);

        // Calculate stats
        const total = referralsData.length;
        const pending = referralsData.filter(
          (r: { status: string }) => r.status === "pending",
        ).length;
        const completed = referralsData.filter(
          (r: { status: string }) => r.status === "completed",
        ).length;

        console.log("📊 Total:", total);
        console.log("📊 Completed:", completed);

        const totalPointsAwarded = referralsData.reduce(
          (sum: number, r: { reward_points_awarded: number | null }) =>
            sum + (r.reward_points_awarded || 0),
          0,
        );

        console.log("📊 Total points awarded:", totalPointsAwarded);

        setStats({ total, pending, completed, totalPointsAwarded });
      }
    }

    setLoading(false);
  };

  const filteredReferrals = referrals.filter((referral) => {
    // Status filter
    if (statusFilter !== "all" && referral.status !== statusFilter) {
      return false;
    }

    // Search filter
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
    <div className="min-h-screen bg-gray-50">
      <main className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Referrals</h1>
          <p className="text-gray-600 mt-1">
            Track customer referrals and rewards
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Total Referrals</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">
              {stats.pending}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.completed}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Points Awarded</p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.totalPointsAwarded}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, phone, or referral code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Referrals Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No referrals yet
            </h3>
            <p className="text-gray-600">
              {statusFilter !== "all"
                ? `No ${statusFilter} referrals found`
                : "Customers will appear here when they refer friends"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referrer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referred Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReferrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {referral.referrer?.full_name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatPhone(referral.referrer?.phone || "")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {referral.referred?.full_name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatPhone(referral.referred?.phone || "")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-semibold text-blue-600">
                        {referral.referral_code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          referral.status,
                        )}`}
                      >
                        {referral.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {referral.reward_points_awarded || 0} pts
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(referral.created_at)}
                      {referral.completed_at && (
                        <div className="text-xs text-green-600">
                          Completed: {formatDate(referral.completed_at)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
