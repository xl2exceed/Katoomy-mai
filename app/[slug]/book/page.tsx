"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

interface Business {
  id: string;
  name: string;
  primary_color: string;
}


interface StaffMember {
  id: string;
  full_name: string;
  display_name: string | null;
  role: string | null;
  photo_url: string | null;
}

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<
    { time: string; available: boolean }[]
  >([]);
  const [businessHours, setBusinessHours] = useState<{
    open_time: string;
    close_time: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"staff" | "date" | "time">("date");
  const [memberDiscountPercent, setMemberDiscountPercent] = useState<number | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
  const [vehicleBasedPriceCents, setVehicleBasedPriceCents] = useState<number | null>(null);
  const [addonTotalCents, setAddonTotalCents] = useState(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (selectedDate) {
      loadTimeSlotsForDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedStaffId]);

  const loadData = async () => {
    const supabase = createClient();

    // Get selected service from sessionStorage
    const serviceId = sessionStorage.getItem("selectedServiceId");
    if (!serviceId) {
      router.push(`/${slug}/services`);
      return;
    }

    // Carwash pricing overrides
    const savedVehiclePrice = sessionStorage.getItem("vehicleBasedPriceCents");
    if (savedVehiclePrice) setVehicleBasedPriceCents(parseInt(savedVehiclePrice, 10));
    const savedAddonTotal = parseInt(sessionStorage.getItem("addonTotalCents") || "0", 10);
    setAddonTotalCents(savedAddonTotal);

    // Get business
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color")
      .eq("slug", slug)
      .single();

    if (businessData) {
      setBusiness(businessData);

      // Get business hours
      const { data: hoursData } = await supabase
        .from("availability_rules")
        .select("start_time, end_time")
        .eq("business_id", businessData.id)
        .single();

      if (hoursData) {
        setBusinessHours({
          open_time: hoursData.start_time,
          close_time: hoursData.end_time,
        });
      }

      // Get service
      const { data: serviceData } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .single();

      if (serviceData) {
        setService(serviceData);
      }

      // Check if saved customer is an active member via server-side API (bypasses RLS)
      const savedPhone = localStorage.getItem("katoomy:customerPhone");
      if (savedPhone) {
        try {
          const checkRes = await fetch(
            `/api/memberships/check?businessId=${businessData.id}&phone=${savedPhone.replace(/\D/g, "")}`,
          );
          const checkData = await checkRes.json();
          if (checkData.discountPercent > 0) {
            setMemberDiscountPercent(checkData.discountPercent);
          }
        } catch {
          // non-critical
        }
      }

      // Fetch staff members available for booking
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name, display_name, role, photo_url')
        .eq('business_id', businessData.id)
        .eq('visible_for_booking', true)
        .eq('accepting_new_clients', true)
        .eq('is_active', true)
        .order('full_name');
      if (staffData && staffData.length > 0) {
        setStaffMembers(staffData);
        setStep("staff");
      }


      // Get business availability rules to filter days
      const { data: availRules } = await supabase
        .from("availability_rules")
        .select("days_open")
        .eq("business_id", businessData.id)
        .single();

      const openDays = availRules?.days_open || [];

      // Generate next 14 days, but only include days business is open
      const dates: string[] = [];
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        // Create date string in LOCAL timezone (not UTC)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        // Get day name from the SAME local date
        const dayName = date
          .toLocaleDateString("en-US", { weekday: "long" })
          .toLowerCase();

        // Only add if business is open on this day
        if (openDays.includes(dayName)) {
          dates.push(dateString);
        }
      }
      setAvailableDates(dates);
    }

    setLoading(false);
  };

  const loadTimeSlotsForDate = async () => {
    const supabase = createClient();
    if (!businessHours || !business || !service) return;

    // Parse business hours
    const openHour = parseInt(businessHours.open_time.split(":")[0]);
    const closeHour = parseInt(businessHours.close_time.split(":")[0]);

    // Check if selected date is today (in local timezone)
    const now = new Date();
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const isToday = selectedDate === todayString;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Generate all possible time slots
    const allSlots: { time: string; available: boolean }[] = [];
    for (let hour = openHour; hour < closeHour; hour++) {
      // For today, skip time slots that have already passed
      if (isToday) {
        // Check :00 slot
        if (hour > currentHour || (hour === currentHour && currentMinute < 0)) {
          allSlots.push({
            time: `${hour.toString().padStart(2, "0")}:00`,
            available: true,
          });
        }
        // Check :30 slot
        if (
          hour > currentHour ||
          (hour === currentHour && currentMinute < 30)
        ) {
          allSlots.push({
            time: `${hour.toString().padStart(2, "0")}:30`,
            available: true,
          });
        }
      } else {
        // For future dates, show all slots
        allSlots.push({
          time: `${hour.toString().padStart(2, "0")}:00`,
          available: true,
        });
        allSlots.push({
          time: `${hour.toString().padStart(2, "0")}:30`,
          available: true,
        });
      }
    }

    // Get existing bookings for this date (account for timezone)
    const startOfDay = new Date(`${selectedDate}T00:00:00`);
    const endOfDay = new Date(`${selectedDate}T23:59:59`);

    // Add timezone offset to ensure we catch bookings that might be stored in different timezone
    startOfDay.setHours(startOfDay.getHours() - 12);
    endOfDay.setHours(endOfDay.getHours() + 12);

    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("start_ts, end_ts, staff_id")
      .eq("business_id", business.id)
      .gte("start_ts", startOfDay.toISOString())
      .lt("start_ts", endOfDay.toISOString())
      .neq("status", "cancelled");

    // Filter bookings to only those that actually fall on the selected date in local time
    const bookingsOnSelectedDate =
      existingBookings?.filter((booking: { start_ts: string }) => {
        const bookingDate = new Date(booking.start_ts);
        const bookingLocalDate = bookingDate.toLocaleDateString("en-CA");
        return bookingLocalDate === selectedDate;
      }) || [];

    const overlaps = (
      booking: { start_ts: string; end_ts: string },
      slotStart: Date,
      slotEnd: Date,
    ) => {
      const bookingStart = new Date(booking.start_ts);
      const bookingEnd = new Date(booking.end_ts);
      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      );
    };

    // Mark slots as unavailable based on staff selection
    allSlots.forEach((slot) => {
      const slotDateTime = new Date(`${selectedDate}T${slot.time}:00`);
      const slotEndTime = new Date(
        slotDateTime.getTime() + service.duration_minutes * 60000,
      );

      let isOverlapping: boolean;
      if (selectedStaffId !== "any") {
        // Block only if the selected staff member has a conflicting booking
        isOverlapping = bookingsOnSelectedDate
          .filter((b: { staff_id: string | null }) => b.staff_id === selectedStaffId)
          .some((b: { start_ts: string; end_ts: string }) => overlaps(b, slotDateTime, slotEndTime));
      } else if (staffMembers.length === 0) {
        // No staff — business is a single resource; block if any booking overlaps
        isOverlapping = bookingsOnSelectedDate
          .some((b: { start_ts: string; end_ts: string }) => overlaps(b, slotDateTime, slotEndTime));
      } else {
        // Has staff, "any" selected — block only if ALL staff are booked at this time
        isOverlapping = staffMembers.every((staff) =>
          bookingsOnSelectedDate
            .filter((b: { staff_id: string | null }) => b.staff_id === staff.id)
            .some((b: { start_ts: string; end_ts: string }) => overlaps(b, slotDateTime, slotEndTime)),
        );
      }

      if (isOverlapping) {
        slot.available = false;
      }
    });

    setAvailableTimes(allSlots);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time");
      return;
    }

    // Store booking details
    sessionStorage.setItem("bookingDate", selectedDate);
    sessionStorage.setItem("bookingTime", selectedTime);
    sessionStorage.setItem("selectedStaffId", selectedStaffId);
    router.push(`/${slug}/customer-info`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    const now = new Date();
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (dateString === todayString) {
      return "Today";
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const formatTime = (time24: string) => {
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${
            business?.primary_color || "#3B82F6"
          } 0%, ${business?.primary_color || "#3B82F6"}DD 100%)`,
        }}
      >
        <Link
          href={`/${slug}/services`}
          className="text-white/80 hover:text-white text-sm mb-2 block"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">{step === "staff" ? "Choose your provider" : step === "time" ? "Select a time" : "Select date & time"}</p>
      </div>

      {/* Service Summary */}
      <div className="p-6">
        <div className="bg-green-600 rounded-xl shadow-lg border border-green-700 p-5">
          <p className="text-sm font-medium text-green-100 uppercase tracking-wide">
            Selected Service
          </p>
          <p className="text-xl font-bold text-white mt-2">{service?.name}</p>
          <div className="mt-3 pt-3 border-t border-green-500">
            {(() => {
              const basePrice = vehicleBasedPriceCents ?? (service?.price_cents ?? 0);
              const total = basePrice + addonTotalCents;
              if (memberDiscountPercent && service) {
                const discounted = Math.round(basePrice * (1 - memberDiscountPercent / 100)) + addonTotalCents;
                return (
                  <>
                    <p className="text-lg text-green-200 line-through">${(total / 100).toFixed(2)}</p>
                    <p className="text-3xl font-bold text-white">${(discounted / 100).toFixed(2)}</p>
                    <p className="text-xs text-green-200 mt-1">⭐ Elite Member price ({memberDiscountPercent}% off)</p>
                  </>
                );
              }
              return <p className="text-3xl font-bold text-white">${(total / 100).toFixed(2)}</p>;
            })()}
          </div>
        </div>
      </div>

      {/* Step 1: Staff Selection */}
      {step === "staff" && (
        <div className="px-6 pb-32">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Who do you want?</h2>
          <div className="space-y-3">
            <button
              onClick={() => setSelectedStaffId("any")}
              className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-4 transition ${
                selectedStaffId === "any" ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">&#10024;</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">No Preference</p>
                <p className="text-sm text-gray-500">Any available provider</p>
              </div>
              {selectedStaffId === "any" && (
                <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
            {staffMembers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStaffId(s.id)}
                className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-4 transition ${
                  selectedStaffId === s.id ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
                }`}
              >
                {s.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo_url} alt={s.full_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-lg">{s.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{s.display_name || s.full_name}</p>
                  {s.role && <p className="text-sm text-gray-500">{s.role}</p>}
                </div>
                {selectedStaffId === s.id && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
            <button
              onClick={() => setStep("date")}
              className="w-full text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition"
              style={{ backgroundColor: business?.primary_color || "#2563EB" }}
            >
              Next: Select Date &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Date Selection */}
      {step === "date" && (
        <div className="px-6 pb-32">
          {staffMembers.length > 0 && (
            <button
              onClick={() => setStep("staff")}
              className="text-blue-600 hover:text-blue-700 font-medium mb-4 block"
            >
              &larr; Change Provider
            </button>
          )}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Select a Date</h2>
          <div className="grid grid-cols-2 gap-3">
            {availableDates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`p-4 rounded-xl transition shadow-md ${
                  selectedDate === date ? "border-4 shadow-xl scale-105" : "border-2 border-transparent"
                }`}
                style={{
                  backgroundColor: business?.primary_color ? `${business.primary_color}30` : "#DBEAFE",
                  borderColor: selectedDate === date ? business?.primary_color || "#3B82F6" : "transparent",
                }}
              >
                <p className="font-semibold text-gray-900">{formatDate(date)}</p>
              </button>
            ))}
          </div>
          {selectedDate && (
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
              <button
                onClick={() => setStep("time")}
                className="w-full text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition"
                style={{ backgroundColor: business?.primary_color || "#2563EB" }}
              >
                Next: Select Time &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Time Selection */}
      {step === "time" && selectedDate && (
        <div className="px-6 pb-32">
          <button
            onClick={() => { setStep("date"); setSelectedTime(""); }}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 block"
          >
            &larr; Change Date
          </button>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Select a Time</h2>
          {availableTimes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-2">No available times for this date</p>
              <p className="text-sm text-gray-500">Please select a different date</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {availableTimes.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && setSelectedTime(slot.time)}
                  disabled={!slot.available}
                  className={`p-3 rounded-xl transition ${
                    !slot.available
                      ? "bg-gray-200 opacity-50 cursor-not-allowed"
                      : selectedTime === slot.time
                        ? "border-4 shadow-xl scale-105"
                        : "border-2 border-transparent shadow-md"
                  }`}
                  style={
                    slot.available
                      ? {
                          backgroundColor:
                            selectedTime === slot.time
                              ? business?.primary_color || "#3B82F6"
                              : business?.primary_color
                                ? `${business.primary_color}30`
                                : "#DBEAFE",
                          borderColor:
                            selectedTime === slot.time
                              ? business?.primary_color || "#3B82F6"
                              : "transparent",
                        }
                      : {}
                  }
                >
                  <p className={`font-semibold ${
                    !slot.available ? "text-gray-400 line-through" : selectedTime === slot.time ? "text-white" : "text-gray-900"
                  }`}>
                    {formatTime(slot.time)}
                  </p>
                </button>
              ))}
            </div>
          )}
          {selectedTime && (
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
              <button
                onClick={handleContinue}
                className="w-full text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition"
                style={{ backgroundColor: business?.primary_color || "#2563EB" }}
              >
                Continue &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}