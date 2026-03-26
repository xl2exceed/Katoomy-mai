"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import { formatPhone } from "@/lib/utils/formatPhone";
import Link from "next/link";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
}

export default function StaffCustomersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/staff/login"); return; }

    const { data: s } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!s) { router.push("/staff/login"); return; }

    // Get distinct customer IDs from this staff member's bookings
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("customer_id")
      .eq("staff_id", s.id);

    const customerIds = [...new Set((bookingRows || []).map((b: { customer_id: string }) => b.customer_id))];

    if (customerIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: custData } = await supabase
      .from("customers")
      .select("id, full_name, phone, email")
      .in("id", customerIds)
      .order("full_name", { ascending: true });

    setCustomers((custData as Customer[]) || []);
    setLoading(false);
  }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.full_name || "");
    setEditPhone(c.phone);
    setEditEmail(c.email || "");
  };

  const handleSave = async () => {
    if (!editingCustomer) return;
    setSaving(true);
    await supabase
      .from("customers")
      .update({ full_name: editName, phone: editPhone, email: editEmail || null })
      .eq("id", editingCustomer.id);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === editingCustomer.id
          ? { ...c, full_name: editName, phone: editPhone, email: editEmail || null }
          : c
      )
    );
    setSaving(false);
    setEditingCustomer(null);
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.full_name || "").toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">
        Back to Menu
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My Customers</h1>

      <input
        type="text"
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 mb-4 text-base"
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl p-8">
          <p className="text-gray-500 text-lg">
            {customers.length === 0 ? "No customers yet" : "No results found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="font-semibold text-gray-900 text-lg">{c.full_name || "Customer"}</p>
              <p className="text-sm text-gray-600 mt-0.5">{formatPhone(c.phone)}</p>
              {c.email && <p className="text-sm text-gray-500 mt-0.5">{c.email}</p>}
              <div className="mt-3 flex gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="flex-1 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold text-center border border-gray-200"
                >
                  Call
                </a>
                <a
                  href={`sms:${c.phone}`}
                  className="flex-1 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold text-center border border-gray-200"
                >
                  Text
                </a>
                <button
                  onClick={() => openEdit(c)}
                  className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-200"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Customer</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
