"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// Safely build a local-timezone ISO string from date ("YYYY-MM-DD") + time ("HH:MM").
// Using new Date(y, m, d, h, min) always interprets as local time in every browser,
// unlike new Date("YYYY-MM-DDTHH:MM:SS") which Safari treats as UTC.
function localDateTimeISO(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0).toISOString();
}

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

interface DepositSettings {
  enabled: boolean;
  type: "flat" | "percent";
  amount_cents: number | null;
  percent: number | null;
}

const PHONE_STORAGE_KEY = "katoomy:customerPhone";

export default function CustomerInfoPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [defaultBookingStatus, setDefaultBookingStatus] =
    useState<string>("confirmed");
  const [depositSettings, setDepositSettings] =
    useState<DepositSettings | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<
    "full" | "deposit" | "cash"
  >("full");
  const [memberDiscountPct, setMemberDiscountPct] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check discount whenever phone field has 10+ digits
  useEffect(() => {
    if (!business) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setMemberDiscountPct(0); return; }
    fetch("/api/memberships/check?businessId=" + business.id + "&phone=" + digits)
      .then((r) => r.json())
      .then((d) => setMemberDiscountPct(d.discountPercent || 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, business]);

  const loadData = async () => {
    const supabase = createClient();

    // Get selected service and booking details from sessionStorage
    const serviceId = sessionStorage.getItem("selectedServiceId");
    const date = sessionStorage.getItem("bookingDate");
    const time = sessionStorage.getItem("bookingTime");
    const staffId = sessionStorage.getItem("selectedStaffId") || "";
    setSelectedStaffId(staffId);

    if (!serviceId || !date || !time) {
      router.push(`/${slug}/services`);
      return;
    }

    setBookingDate(date);
    setBookingTime(time);

    // Get business
    const { data: businessData } = await supabase
      .from("businesses")
      .select("id, name, primary_color, default_booking_status")
      .eq("slug", slug)
      .single();

    if (businessData) {
      setBusiness(businessData);
      setDefaultBookingStatus(
        businessData.default_booking_status || "confirmed",
      );

      // Load deposit settings
      const { data: depositData } = await supabase
        .from("deposit_settings")
        .select("*")
        .eq("business_id", businessData.id)
        .maybeSingle();
      if (depositData) {
        setDepositSettings(depositData as DepositSettings);
        if (depositData.enabled) setPaymentChoice("deposit");
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

      // ── Prefill if we know this customer ──────────────────────────────────
      const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
      if (savedPhone) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("full_name, phone, email")
          .eq("business_id", businessData.id)
          .eq("phone", savedPhone)
          .single();

        if (existingCustomer) {
          setName(existingCustomer.full_name || "");
          setPhone(formatPhone(existingCustomer.phone || ""));
          setEmail(existingCustomer.email || "");
          setPrefilled(true);
        }

        // Check member discount via server-side API (bypasses RLS)
        try {
          const checkRes = await fetch(
            `/api/memberships/check?businessId=${businessData.id}&phone=${savedPhone.replace(/\D/g, "")}`,
          );
          const checkData = await checkRes.json();
          if (checkData.discountPercent > 0) {
            setMemberDiscountPct(checkData.discountPercent);
          }
        } catch {
          // non-critical, server will still apply discount at checkout
        }
      }
      // ─────────────────────────────────────────────────────────────────────
    }

    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time24: string) => {
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6)
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const getDepositCents = (): number => {
    if (!depositSettings || !service) return 0;
    if (depositSettings.type === "flat")
      return depositSettings.amount_cents || 0;
    if (depositSettings.type === "percent" && depositSettings.percent) {
      const baseCents = memberDiscountPct > 0
        ? Math.round(service.price_cents * (1 - memberDiscountPct / 100))
        : service.price_cents;
      return Math.round(baseCents * (depositSettings.percent / 100));
    }
    return 0;
  };

  const handlePayWithStripe = async (type: "full" | "deposit") => {
    if (!business || !service) return;
    setSubmitting(true);

    const cleanPhone = phone.replace(/\D/g, "");
    localStorage.setItem(PHONE_STORAGE_KEY, cleanPhone);

    const pendingReferral = localStorage.getItem("katoomy:pendingReferral");
    const referredByCode = pendingReferral ? JSON.parse(pendingReferral).referralCode : null;
    if (referredByCode) localStorage.removeItem("katoomy:pendingReferral");

    const discountedFullPriceCents = memberDiscountPct > 0
      ? Math.round(service.price_cents * (1 - memberDiscountPct / 100))
      : service.price_cents;

    const priceCents =
      type === "deposit" ? getDepositCents() : service.price_cents;

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        serviceId: service.id,
        serviceName: service.name,
        priceCents,
        fullPriceCents: discountedFullPriceCents,
        paymentType: type,
        customerName: name,
        customerPhone: cleanPhone,
        customerEmail: email || "",
        bookingDate,
        bookingTime,
        startISO: localDateTimeISO(bookingDate, bookingTime),
        durationMinutes: service.duration_minutes,
        notes: notes || "",
        slug,
        staffId: selectedStaffId && selectedStaffId !== "any" ? selectedStaffId : undefined,
        referredByCode: referredByCode || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      alert(data.error || "Failed to start payment. Please try again.");
      setSubmitting(false);
      return;
    }
    window.location.href = data.url;
  };

  const handlePayAtAppointment = async () => {
    if (!business || !service) return;
    setSubmitting(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      localStorage.setItem(PHONE_STORAGE_KEY, cleanPhone);

      const pendingReferral = localStorage.getItem("katoomy:pendingReferral");
      const referredByCode = pendingReferral ? JSON.parse(pendingReferral).referralCode : null;

      const discountedPriceCents = memberDiscountPct > 0
        ? Math.round(service.price_cents * (1 - memberDiscountPct / 100))
        : service.price_cents;

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          serviceId: service.id,
          serviceName: service.name,
          priceCents: discountedPriceCents,
          customerName: name,
          customerPhone: cleanPhone,
          customerEmail: email || "",
          bookingDate,
          bookingTime,
          startISO: localDateTimeISO(bookingDate, bookingTime),
          durationMinutes: service.duration_minutes,
          notes: notes || "",
          slug,
          defaultBookingStatus,
          staffId: selectedStaffId && selectedStaffId !== "any" ? selectedStaffId : undefined,
          referredByCode: referredByCode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      localStorage.removeItem("katoomy:pendingReferral");
      sessionStorage.setItem("bookingId", data.bookingId);
      router.push(`/${slug}/confirmation`);
    } catch (err) {
      console.error("Error creating booking:", err);
      alert("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Please enter your name and phone number");
      return;
    }
    if (!business || !service) return;

    if (paymentChoice === "cash") {
      await handlePayAtAppointment();
    } else if (paymentChoice === "deposit") {
      await handlePayWithStripe("deposit");
    } else {
      await handlePayWithStripe("full");
    }
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
          href={`/${slug}/book`}
          className="text-white/80 hover:text-white text-sm mb-2 block"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{business?.name}</h1>
        <p className="text-white/90 mt-1">Your information</p>
      </div>

      {/* Booking Summary */}
      <div className="p-6">
        <div className="bg-green-600 rounded-xl shadow-lg border border-green-700 p-5 mb-6">
          <p className="text-sm font-medium text-green-100 uppercase tracking-wide mb-2">
            Your Appointment
          </p>
          <p className="text-xl font-bold text-white">{service?.name}</p>
          <div className="mt-3 pt-3 border-t border-green-500 space-y-1">
            <p className="text-white">{formatDate(bookingDate)}</p>
            <p className="text-white">{formatTime(bookingTime)}</p>
            {memberDiscountPct > 0 && service ? (
              <>
                <p className="text-lg text-green-200 line-through mt-2">
                  ${(service.price_cents / 100).toFixed(2)}
                </p>
                <p className="text-2xl font-bold text-white">
                  ${(Math.round(service.price_cents * (1 - memberDiscountPct / 100)) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-green-200">⭐ Elite Member price ({memberDiscountPct}% off)</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-white mt-2">
                ${service ? (service.price_cents / 100).toFixed(2) : "0.00"}
              </p>
            )}
          </div>
        </div>

        {/* Prefilled notice */}
        {prefilled && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-2">
            <span className="text-green-600 text-lg">✓</span>
            <p className="text-green-700 text-sm font-medium">
              We found your info — just confirm below and book.
            </p>
          </div>
        )}

        {/* Customer Info Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=""
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder=""
              maxLength={14}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or notes..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>

        {/* Payment Choice */}
        {service && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              How would you like to pay?
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPaymentChoice("full")}
                className={`w-full p-4 rounded-xl border-2 text-left transition ${
                  paymentChoice === "full"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      💳 Pay Full Amount Now
                    </p>
                    <p className="text-sm text-gray-500">
                      Secure payment via card
                    </p>
                  </div>
                  <div className="text-right">
                    {memberDiscountPct > 0 ? (
                      <>
                        <p className="text-sm text-gray-400 line-through">${(service.price_cents / 100).toFixed(2)}</p>
                        <p className="font-bold text-gray-900">${(Math.round(service.price_cents * (1 - memberDiscountPct / 100)) / 100).toFixed(2)}</p>
                      </>
                    ) : (
                      <p className="font-bold text-gray-900">${(service.price_cents / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </button>

              {depositSettings?.enabled && (
                <button
                  type="button"
                  onClick={() => setPaymentChoice("deposit")}
                  className={`w-full p-4 rounded-xl border-2 text-left transition ${
                    paymentChoice === "deposit"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        💳 Pay Deposit Now
                      </p>
                      <p className="text-sm text-gray-500">
                        {service && memberDiscountPct > 0
                          ? `$${((Math.round(service.price_cents * (1 - memberDiscountPct / 100)) - getDepositCents()) / 100).toFixed(2)} remaining at appointment`
                          : "Remainder due at appointment"}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900">
                      ${(getDepositCents() / 100).toFixed(2)}
                    </p>
                  </div>
                </button>
              )}

              {!depositSettings?.enabled && (
                <button
                  type="button"
                  onClick={() => setPaymentChoice("cash")}
                  className={`w-full p-4 rounded-xl border-2 text-left transition ${
                    paymentChoice === "cash"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      💵 Pay at Appointment
                    </p>
                    <p className="text-sm text-gray-500">
                      Cash or card in person
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom padding for fixed button */}
        <div className="h-32"></div>
      </div>

      {/* Submit Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim() || !phone.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Please wait..."
            : paymentChoice === "cash"
              ? "Book Appointment →"
              : paymentChoice === "deposit"
                ? `Pay Deposit $${(getDepositCents() / 100).toFixed(2)} →`
                : memberDiscountPct > 0 && service
              ? `Pay $${(Math.round(service.price_cents * (1 - memberDiscountPct / 100)) / 100).toFixed(2)} →`
              : `Pay $${service ? (service.price_cents / 100).toFixed(2) : "0.00"} →`}
        </button>
      </div>
    </div>
  );
}
