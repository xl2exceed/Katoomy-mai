"use client";

import { formatPhone } from "@/lib/utils/formatPhone";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
}

export default function MobileCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const biz = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();
    if (biz.data) {
      const cust = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .eq("business_id", biz.data.id)
        .order("created_at", { ascending: false });
      setCustomers(cust.data || []);
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
      loadData(); // Reload the list
    }

    setSaving(false);
  };

  const handleCancel = () => {
    setEditingCustomer(null);
    setEditName("");
    setEditPhone("");
    setEditEmail("");
  };

  const filtered = customers.filter((c) => {
    const s = search.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(s)) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <Link
          href="/admin/mobile/menu"
          className="inline-flex items-center text-white mb-4"
        >
          <span className="text-2xl mr-2">←</span>
          <span className="font-medium">Back to Menu</span>
        </Link>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-blue-100 mt-1">{customers.length} total customers</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Customers
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-base text-gray-900"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {search ? "No customers found" : "No customers yet"}
                </h3>
                {search && (
                  <p className="text-gray-600">Try a different search term</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {c.full_name || "Customer"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatPhone(c.phone)}
                      </p>
                      {c.email && (
                        <p className="text-sm text-gray-600">{c.email}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <a
                          href={`tel:${c.phone}`}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-center active:scale-95 transition shadow"
                        >
                          Call 📞
                        </a>

                        <a
                          href={`sms:${c.phone}`}
                          className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-center active:scale-95 transition shadow"
                        >
                          Text 💬
                        </a>
                      </div>

                      <button
                        onClick={() => handleEditClick(c)}
                        className="w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-bold active:scale-95 transition"
                      >
                        ✏️ Edit Info
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
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
