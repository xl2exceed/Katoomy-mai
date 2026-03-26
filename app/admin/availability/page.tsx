"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface AvailabilityRules {
  days_open: string[];
  start_time: string;
  end_time: string;
  buffer_minutes: number;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export default function AvailabilityPage() {
  const [availability, setAvailability] = useState<AvailabilityRules>({
    days_open: [],
    start_time: "09:00",
    end_time: "17:00",
    buffer_minutes: 15,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (!business?.id) return;

      setBusinessId(business.id);

      const { data: rules } = await supabase
        .from("availability_rules")
        .select("*")
        .eq("business_id", business.id)
        .single();

      if (rules) {
        setAvailability({
          days_open: rules.days_open || [],
          start_time: rules.start_time || "09:00",
          end_time: rules.end_time || "17:00",
          buffer_minutes: rules.buffer_minutes ?? 15,
        });
      }
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setAvailability((prev) => {
      const isSelected = prev.days_open.includes(day);
      return {
        ...prev,
        days_open: isSelected
          ? prev.days_open.filter((d) => d !== day)
          : [...prev.days_open, day],
      };
    });
  };

  const saveAvailability = async () => {
    if (!businessId) return;

    try {
      setSaving(true);

      const payload = {
        business_id: businessId,
        days_open: availability.days_open,
        start_time: availability.start_time,
        end_time: availability.end_time,
        buffer_minutes: availability.buffer_minutes,
      };

      const { error } = await supabase
        .from("availability_rules")
        .upsert(payload, { onConflict: "business_id" });

      if (error) throw error;

      await loadAvailability();
    } catch (error) {
      console.error("Error saving availability:", error);
      alert("Failed to save availability. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Availability</h1>
              <p className="text-gray-600 mt-1">
                Choose which days you’re open and set your working hours.
              </p>
            </div>

            <button
              onClick={saveAvailability}
              disabled={saving || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading...</div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Open Days
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DAYS_OF_WEEK.map((d) => {
                    const selected = availability.days_open.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Working Hours
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={availability.start_time}
                      onChange={(e) =>
                        setAvailability((prev) => ({
                          ...prev,
                          start_time: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={availability.end_time}
                      onChange={(e) =>
                        setAvailability((prev) => ({
                          ...prev,
                          end_time: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buffer (minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={availability.buffer_minutes}
                      onChange={(e) =>
                        setAvailability((prev) => ({
                          ...prev,
                          buffer_minutes: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="15"
                    />
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Tip: Buffer time adds extra minutes between bookings to prevent
                back-to-back appointments.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
