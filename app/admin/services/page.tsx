// file: app/admin/services/page.tsx

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  active: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [niche, setNiche] = useState("barber");

  const supabase = createClient();

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadServices = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id, features")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);
      const features = (business as typeof business & { features?: Record<string, string> }).features || {};
      setNiche(features.niche || "barber");

      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      setServices(data || []);
    }

    setLoading(false);
  };

  const handleOpenModal = (service?: Service) => {
    setEditingService(service || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleToggleActive = async (service: Service) => {
    await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);

    loadServices();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Services</h1>
              <p className="text-gray-600 mt-1">
                Manage your services, pricing, and duration
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              + Add Service
            </button>
          </div>

          {/* Services List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-6xl mb-4">{niche === "carwash" ? "🚗" : "✂️"}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No services yet
              </h3>
              <p className="text-gray-600 mb-6">
                Add your first service to start accepting bookings
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Add Service
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition ${
                    service.active
                      ? "border-gray-100"
                      : "border-gray-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {service.name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        service.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {service.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-gray-600">
                      <span className="text-2xl font-bold text-gray-900">
                        ${(service.price_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">⏱️</span>
                      <span>{service.duration_minutes} minutes</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleOpenModal(service)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(service)}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                        service.active
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {service.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Service Modal */}
      {isModalOpen && (
        <ServiceModal
          service={editingService}
          businessId={businessId}
          onClose={handleCloseModal}
          onSave={() => {
            handleCloseModal();
            loadServices();
          }}
        />
      )}
    </div>
  );
}

function ServiceModal({
  service,
  businessId,
  onClose,
  onSave,
}: {
  service: Service | null;
  businessId: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(service?.name || "");
  const [price, setPrice] = useState(
    service ? (service.price_cents / 100).toString() : "",
  );
  const [duration, setDuration] = useState(
    service?.duration_minutes.toString() || "",
  );
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    setLoading(true);

    const serviceData = {
      business_id: businessId,
      name,
      price_cents: Math.round(parseFloat(price) * 100),
      duration_minutes: parseInt(duration),
      active: true,
    };

    if (service) {
      await supabase.from("services").update(serviceData).eq("id", service.id);
    } else {
      await supabase.from("services").insert(serviceData);
    }

    setLoading(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {service ? "Edit Service" : "Add Service"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Haircut"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="35.00"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "Saving..." : service ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
