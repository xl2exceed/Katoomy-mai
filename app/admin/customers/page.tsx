// file: app/admin/customers/page.tsx

"use client";

import { formatPhone } from "@/lib/utils/formatPhone";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  created_at: string;
  booking_count?: number;
  total_spent?: number;
  last_visit?: string;
  loyalty_points?: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "bookings" | "spending">(
    "recent",
  );

  const supabase = createClient();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomers = async () => {
    // Force refresh auth session
    await supabase.auth.refreshSession();

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
      // Get customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      if (customersData) {
        // Get booking counts and totals for each customer
        const enrichedCustomers = await Promise.all(
          customersData.map(
            async (customer: {
              id: string;
              business_id: string;
              full_name: string | null;
              phone: string;
              email: string | null;
              created_at: string;
              user_id: string | null;
            }) => {
              // Get booking count
              const { count: bookingCount } = await supabase
                .from("bookings")
                .select("*", { count: "exact", head: true })
                .eq("customer_id", customer.id)
                .eq("status", "completed");

              // Get total spent
              const { data: completedBookings } = await supabase
                .from("bookings")
                .select("total_price_cents")
                .eq("customer_id", customer.id)
                .eq("status", "completed");

              const totalSpent =
                completedBookings?.reduce(
                  (sum: number, b: { total_price_cents: number }) =>
                    sum + b.total_price_cents,
                  0,
                ) || 0;

              // Get last visit
              const { data: lastBooking } = await supabase
                .from("bookings")
                .select("start_ts")
                .eq("customer_id", customer.id)
                .eq("status", "completed")
                .order("start_ts", { ascending: false })
                .limit(1)
                .maybeSingle();

              // Get loyalty points
              const { data: loyaltyData } = await supabase
                .from("loyalty_ledger")
                .select("points_delta")
                .eq("customer_id", customer.id);

              const loyaltyPoints =
                loyaltyData?.reduce(
                  (sum: number, entry: { points_delta: number }) =>
                    sum + entry.points_delta,
                  0,
                ) || 0;

              return {
                ...customer,
                booking_count: bookingCount || 0,
                total_spent: totalSpent,
                last_visit: lastBooking?.start_ts,
                loyalty_points: loyaltyPoints,
              };
            },
          ),
        );

        setCustomers(enrichedCustomers);
      }
    }

    setLoading(false);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.full_name || "");
    setEditPhone(customer.phone);
    setEditEmail(customer.email || "");
  };

  const handleSave = async () => {
    if (!editingCustomer) return;

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        full_name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
      })
      .eq("id", editingCustomer.id);

    if (error) {
      alert("Error saving customer");
      console.error(error);
    } else {
      setEditingCustomer(null);
      loadCustomers(); // Reload the list
    }

    setSaving(false);
  };

  const handleCancel = () => {
    setEditingCustomer(null);
    setEditName("");
    setEditPhone("");
    setEditEmail("");
  };

  const filteredAndSortedCustomers = customers
    .filter((customer) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        customer.full_name?.toLowerCase().includes(searchLower) ||
        customer.phone.includes(searchQuery) ||
        customer.email?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "bookings":
          return (b.booking_count || 0) - (a.booking_count || 0);
        case "spending":
          return (b.total_spent || 0) - (a.total_spent || 0);
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">
              View and manage your customer contacts
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {customers.length}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <p className="text-sm text-gray-600">Repeat Customers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {customers.filter((c) => (c.booking_count || 0) > 1).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <p className="text-sm text-gray-600">Avg Bookings</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {customers.length > 0
                      ? (
                          customers.reduce(
                            (sum, c) => sum + (c.booking_count || 0),
                            0,
                          ) / customers.length
                        ).toFixed(1)
                      : 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    $
                    {(
                      customers.reduce(
                        (sum, c) => sum + (c.total_spent || 0),
                        0,
                      ) / 100
                    ).toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  {/* Search */}
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, phone, or email..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Sort */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as "recent" | "bookings" | "spending",
                        )
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="bookings">Most Bookings</option>
                      <option value="spending">Highest Spending</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Customers List */}
              {filteredAndSortedCustomers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {searchQuery ? "No customers found" : "No customers yet"}
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery
                      ? "Try adjusting your search"
                      : "Customers will appear here once they book appointments"}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bookings
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Spent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Points
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Visit
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedCustomers.map((customer) => (
                          <tr
                            key={customer.id}
                            className="hover:bg-gray-50 transition"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-700 font-semibold">
                                    {(customer.full_name || customer.phone)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {customer.full_name || "—"}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Joined{" "}
                                    {new Date(
                                      customer.created_at,
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatPhone(customer.phone)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {customer.booking_count}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${((customer.total_spent || 0) / 100).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-yellow-500 mr-1">⭐</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {customer.loyalty_points || 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {customer.last_visit
                                ? new Date(
                                    customer.last_visit,
                                  ).toLocaleDateString()
                                : "Never"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => handleEditClick(customer)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Edit Customer
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
