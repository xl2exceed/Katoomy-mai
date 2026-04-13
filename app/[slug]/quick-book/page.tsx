"use client";
// file: app/[slug]/quick-book/page.tsx
// Quick Book page — shows a customer's saved default booking settings.
// Each field has an Edit link that routes to the relevant booking step and returns here.
// "Book It" finds the next occurrence of the saved day/time and creates the booking.

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const PHONE_KEY = "katoomy:customerPhone";

const DAY_ORDER = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

interface Business {
  id: string;
  name: string;
  primary_color: string;
  features?: Record<string, unknown>;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  pricing_type?: string;
}

interface StaffInfo {
  id: string;
  full_name: string;
  display_name: string | null;
  role: string | null;
  photo_url: string | null;
}

interface AddonInfo {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

interface QuickBookDefaults {
  id: string;
  service_id: string;
  staff_id: string | null;
  booking_time: string;
  booking_day_of_week: string;
  vehicle_type: string | null;
  vehicle_condition: string | null;
  addon_ids: string[];
  services: ServiceInfo;
  staff: StaffInfo | null;
  addons: AddonInfo[];
}

// Pending edits stored in sessionStorage when user returns from an edit step
const EDIT_KEYS = {
  staffId:          "qbEdit_staffId",
  time:             "qbEdit_time",
  dayOfWeek:        "qbEdit_dayOfWeek",
  serviceId:        "qbEdit_serviceId",
  servicePriceCents:"qbEdit_servicePriceCents",
  addonIds:         "qbEdit_addonIds",
  vehicleType:      "qbEdit_vehicleType",
  vehicleCondition: "qbEdit_vehicleCondition",
} as const;

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatTime(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

/** Find the next calendar date (from today) that falls on dayOfWeek and is a business open day */
function nextDateForDay(dayOfWeek: string, openDays: string[]): string | null {
  if (!openDays.includes(dayOfWeek)) return null;
  const targetIdx = DAY_ORDER.indexOf(dayOfWeek);
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === targetIdx) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2,"0");
      const da = String(d.getDate()).padStart(2,"0");
      return `${y}-${mo}-${da}`;
    }
  }
  return null;
}

function dayLabel(dayOfWeek: string, nextDate: string | null): string {
  if (!nextDate) return capitalize(dayOfWeek);
  const d = new Date(nextDate + "T00:00:00");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const isToday = nextDate === todayStr;
  if (isToday) return `${capitalize(dayOfWeek)}s (next: Today)`;
  return `${capitalize(dayOfWeek)}s (next: ${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})})`;
}

export default function QuickBookPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [business, setBusiness]       = useState<Business | null>(null);
  const [customer, setCustomer]       = useState<Customer | null>(null);
  const [defaults, setDefaults]       = useState<QuickBookDefaults | null>(null);
  const [openDays, setOpenDays]       = useState<string[]>([]);
  const [isCarwash, setIsCarwash]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [noDefaults, setNoDefaults]   = useState(false);   // customer has no prior bookings
  const [noPhone, setNoPhone]         = useState(false);   // not logged in

  // Pending edits collected from sessionStorage after returning from an edit step
  const [pendingEdits, setPendingEdits] = useState<Partial<Record<keyof typeof EDIT_KEYS, string>>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Availability check
  const [nextDate, setNextDate]           = useState<string | null>(null);
  const [staffUnavailable, setStaffUnavailable] = useState(false);

  // Booking state
  const [booking, setBooking]       = useState(false);
  const [bookError, setBookError]   = useState("");
  const [booked, setBooked]         = useState(false);

  // Surcharge data (car wash)
  const [surcharges, setSurcharges] = useState<Record<string,number>>({});

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, name, primary_color, features")
      .eq("slug", slug)
      .single();
    if (!biz) { setLoading(false); return; }
    setBusiness(biz);

    const features = biz.features as Record<string, unknown> | null;
    const carwash = (features?.niche as string) === "carwash";
    setIsCarwash(carwash);

    if (carwash) {
      try {
        const r = await fetch(`/api/carwash/settings?businessId=${biz.id}`);
        if (r.ok) { const cs = await r.json(); if (cs?.vehicle_surcharges) setSurcharges(cs.vehicle_surcharges); }
      } catch {}
    }

    const { data: availRules } = await supabase
      .from("availability_rules")
      .select("days_open")
      .eq("business_id", biz.id)
      .single();
    setOpenDays(availRules?.days_open || []);

    // Phone lookup
    const phone = localStorage.getItem(PHONE_KEY);
    if (!phone) { setNoPhone(true); setLoading(false); return; }

    // Check for pending edits from a just-completed edit step
    const edits: Partial<Record<keyof typeof EDIT_KEYS, string>> = {};
    let hasPending = false;
    for (const [k, ssKey] of Object.entries(EDIT_KEYS)) {
      const v = sessionStorage.getItem(ssKey);
      if (v !== null) { edits[k as keyof typeof EDIT_KEYS] = v; hasPending = true; }
    }
    if (hasPending) { setPendingEdits(edits); setShowSaveModal(true); }

    // Load defaults
    const res = await fetch(`/api/quick-book/defaults?businessId=${biz.id}&phone=${phone.replace(/\D/g,"")}`);
    const json = await res.json();

    if (!json.defaults) {
      setNoDefaults(true);
      setLoading(false);
      return;
    }

    const d: QuickBookDefaults = json.defaults;
    setDefaults(d);

    // Load customer info for booking
    const cust = await supabaseAdmin_clientSafe(supabase, biz.id, phone.replace(/\D/g,""));
    if (cust) setCustomer(cust);

    // Find next date
    const nd = nextDateForDay(d.booking_day_of_week, availRules?.days_open || []);
    setNextDate(nd);

    // Check staff availability if a staff member is saved
    if (nd && d.staff_id && d.staff_id !== "any") {
      const available = await checkSlotAvailable(biz.id, nd, d.booking_time, d.staff_id, d.services.duration_minutes);
      if (!available) setStaffUnavailable(true);
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => { loadData(); }, [loadData]);

  // Helper: load customer using client-side supabase (RLS public read of customers)
  async function supabaseAdmin_clientSafe(sb: ReturnType<typeof createClient>, businessId: string, phone: string) {
    const { data } = await sb
      .from("customers")
      .select("id, full_name, phone, email")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .single();
    return data as Customer | null;
  }

  async function checkSlotAvailable(
    businessId: string,
    date: string,
    time: string,
    staffId: string,
    durationMinutes: number,
  ): Promise<boolean> {
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd   = new Date(slotStart.getTime() + durationMinutes * 60000);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("start_ts, end_ts")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .gte("start_ts", new Date(`${date}T00:00:00`).toISOString())
      .lt("start_ts",  new Date(`${date}T23:59:59`).toISOString())
      .neq("status", "cancelled");

    const conflicts = (bookings || []).filter((b: { start_ts: string; end_ts: string }) => {
      const bStart = new Date(b.start_ts);
      const bEnd   = new Date(b.end_ts);
      return slotStart < bEnd && slotEnd > bStart;
    });
    return conflicts.length === 0;
  }

  // Discard pending edits
  function clearPendingEdits() {
    for (const ssKey of Object.values(EDIT_KEYS)) sessionStorage.removeItem(ssKey);
    setPendingEdits({});
    setShowSaveModal(false);
  }

  // Apply pending edits to current defaults display (one-time — don't save to DB)
  function applyEditsOneTime() {
    if (!defaults) return;
    const updated = applyEditsToDefaults(defaults, pendingEdits);
    setDefaults(updated);
    // Recompute next date if day changed
    if (pendingEdits.dayOfWeek) {
      const nd = nextDateForDay(pendingEdits.dayOfWeek, openDays);
      setNextDate(nd);
    }
    clearPendingEdits();
    setStaffUnavailable(false);
  }

  // Apply pending edits and save to DB as new default
  async function applyEditsAsDefault() {
    if (!defaults || !business || !customer) return;
    const updated = applyEditsToDefaults(defaults, pendingEdits);
    setDefaults(updated);
    if (pendingEdits.dayOfWeek) {
      const nd = nextDateForDay(pendingEdits.dayOfWeek, openDays);
      setNextDate(nd);
    }
    clearPendingEdits();
    setStaffUnavailable(false);

    const phone = localStorage.getItem(PHONE_KEY);
    if (!phone) return;
    await fetch("/api/quick-book/defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        phone: phone.replace(/\D/g, ""),
        defaults: {
          service_id:        updated.service_id,
          staff_id:          updated.staff_id,
          booking_time:      updated.booking_time,
          booking_day_of_week: updated.booking_day_of_week,
          vehicle_type:      updated.vehicle_type,
          vehicle_condition: updated.vehicle_condition,
          addon_ids:         updated.addon_ids,
        },
      }),
    });
  }

  function applyEditsToDefaults(d: QuickBookDefaults, edits: Partial<Record<keyof typeof EDIT_KEYS, string>>): QuickBookDefaults {
    const updated = { ...d };
    if (edits.staffId !== undefined)   updated.staff_id = edits.staffId === "any" ? null : edits.staffId;
    if (edits.time !== undefined)      updated.booking_time = edits.time;
    if (edits.dayOfWeek !== undefined) updated.booking_day_of_week = edits.dayOfWeek;
    if (edits.serviceId !== undefined) updated.service_id = edits.serviceId;
    if (edits.addonIds !== undefined) {
      try { updated.addon_ids = JSON.parse(edits.addonIds); } catch {}
    }
    if (edits.vehicleType !== undefined)     updated.vehicle_type = edits.vehicleType;
    if (edits.vehicleCondition !== undefined) updated.vehicle_condition = edits.vehicleCondition;
    return updated;
  }

  // Seed sessionStorage so the edit step pages have the data they need
  function seedSessionForEdit() {
    if (!defaults) return;
    sessionStorage.setItem("selectedServiceId", defaults.service_id);
    sessionStorage.setItem("selectedStaffId", defaults.staff_id || "any");
    sessionStorage.setItem("quickBookReturn", "1");
    if (defaults.vehicle_type) sessionStorage.setItem("selectedVehicleType", defaults.vehicle_type);
    if (defaults.vehicle_condition) sessionStorage.setItem("selectedVehicleCondition", defaults.vehicle_condition);
    if (defaults.addon_ids.length > 0) sessionStorage.setItem("selectedAddonIds", JSON.stringify(defaults.addon_ids));
    // Set vehicle-based price if carwash
    if (isCarwash && defaults.vehicle_type) {
      const surcharge = surcharges[defaults.vehicle_type] ?? 0;
      sessionStorage.setItem("vehicleBasedPriceCents", String(defaults.services.price_cents + surcharge));
      // Mark vehicleJustSelected so services page doesn't redirect to vehicle
      sessionStorage.setItem("vehicleJustSelected", "1");
    }
  }

  const handleBookIt = async () => {
    if (!defaults || !business || !customer || !nextDate) return;
    setBooking(true);
    setBookError("");

    // Check availability one more time
    if (defaults.staff_id && defaults.staff_id !== "any") {
      const available = await checkSlotAvailable(
        business.id, nextDate, defaults.booking_time,
        defaults.staff_id, defaults.services.duration_minutes
      );
      if (!available) {
        setStaffUnavailable(true);
        setBooking(false);
        setBookError("That time slot is no longer available. Please edit the time or staff member.");
        return;
      }
    }

    const startDateTime = new Date(`${nextDate}T${defaults.booking_time}:00`);
    const surcharge = (isCarwash && defaults.vehicle_type) ? (surcharges[defaults.vehicle_type] ?? 0) : 0;
    const servicePriceCents = defaults.services.price_cents + surcharge;
    const addonTotal = defaults.addons.filter(a => defaults.addon_ids.includes(a.id)).reduce((s,a) => s + a.price_cents, 0);
    const totalPriceCents = servicePriceCents + addonTotal;

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId:    business.id,
        serviceId:     defaults.service_id,
        serviceName:   defaults.services.name,
        priceCents:    totalPriceCents,
        customerName:  customer.full_name,
        customerPhone: customer.phone,
        customerEmail: customer.email || "",
        bookingDate:   nextDate,
        bookingTime:   defaults.booking_time,
        startISO:      startDateTime.toISOString(),
        durationMinutes: defaults.services.duration_minutes,
        staffId:       defaults.staff_id || null,
        vehicleType:   defaults.vehicle_type || null,
        vehicleCondition: defaults.vehicle_condition || null,
        addonIds:      defaults.addon_ids.length > 0 ? defaults.addon_ids : null,
        defaultBookingStatus: "requested",
      }),
    });

    if (!res.ok) {
      setBookError("Booking failed. Please try again.");
      setBooking(false);
      return;
    }

    setBooked(true);
    setBooking(false);
    setTimeout(() => router.push(`/${slug}/dashboard`), 2000);
  };

  const color = business?.primary_color || "#3B82F6";

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: color }} />
          <p className="mt-4 text-gray-600">Loading Quick Book...</p>
        </div>
      </div>
    );
  }

  // ─── No Phone / Not Logged In ─────────────────────────────────────────────────
  if (noPhone) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` }}>
          <Link href={`/${slug}/dashboard`} className="text-white/80 text-sm mb-2 block">← Back</Link>
          <h1 className="text-2xl font-bold">Quick Book</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign In First</h2>
            <p className="text-gray-600 text-sm mb-6">
              Please access your dashboard to sign in, then come back to Quick Book.
            </p>
            <Link href={`/${slug}/dashboard`} className="inline-block px-6 py-3 rounded-xl text-white font-semibold" style={{ backgroundColor: color }}>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── No Defaults (first-time customer) ───────────────────────────────────────
  if (noDefaults) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` }}>
          <Link href={`/${slug}/dashboard`} className="text-white/80 text-sm mb-2 block">← Back</Link>
          <h1 className="text-2xl font-bold">Quick Book</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Quick Book isn&apos;t set up yet</h2>
            <p className="text-gray-600 text-sm mb-6">
              Quick Book becomes available after your first appointment. Once you&apos;ve completed a booking, we&apos;ll save your preferences so you can re-book in seconds.
            </p>
            <Link
              href={`/${slug}/services`}
              className="inline-block px-6 py-3 rounded-xl text-white font-semibold"
              style={{ backgroundColor: color }}
            >
              Book Your First Appointment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!defaults) return null;

  // ─── Booked Success ───────────────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
          <p className="text-gray-600 text-sm">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  const surcharge = (isCarwash && defaults.vehicle_type) ? (surcharges[defaults.vehicle_type] ?? 0) : 0;
  const servicePriceCents = defaults.services.price_cents + surcharge;
  const addonTotal = defaults.addons.filter(a => defaults.addon_ids.includes(a.id)).reduce((s,a) => s + a.price_cents, 0);
  const totalPriceCents = servicePriceCents + addonTotal;

  const staffName = defaults.staff ? (defaults.staff.display_name || defaults.staff.full_name) : "No preference";

  const vehicleLabels: Record<string,string> = {
    sedan: "Sedan / Coupe", suv: "SUV / Crossover",
    truck: "Truck / Pickup", van: "Van / Minivan", other: "Other",
  };
  const conditionLabels: Record<string,string> = { light: "Lightly soiled", heavy: "Heavily soiled" };

  // ─── Main Quick Book Page ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` }}>
        <Link href={`/${slug}/dashboard`} className="text-white/80 text-sm mb-2 block">← Back to Dashboard</Link>
        <h1 className="text-2xl font-bold">Quick Book</h1>
        <p className="text-white/90 mt-1">Your saved booking preferences</p>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-4 pb-32">
        {/* Staff unavailability warning */}
        {staffUnavailable && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
            <p className="font-semibold text-orange-800 text-sm">
              ⚠️ {staffName} isn&apos;t available at your usual time on the next {capitalize(defaults.booking_day_of_week)}.
            </p>
            <p className="text-orange-700 text-xs mt-1">
              Edit your time or staff member below, then tap &quot;Book It&quot;.
            </p>
          </div>
        )}

        {/* Summary card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Saved Preferences</p>
          </div>

          {/* Service */}
          <Row
            label="Service"
            value={defaults.services.name}
            sub={`$${(servicePriceCents / 100).toFixed(2)}`}
            onEdit={() => {
              seedSessionForEdit();
              router.push(`/${slug}/services?from=quick-book`);
            }}
            color={color}
          />

          {/* Day & Time */}
          <Row
            label="Day"
            value={dayLabel(defaults.booking_day_of_week, nextDate)}
            onEdit={() => {
              seedSessionForEdit();
              router.push(`/${slug}/book?from=quick-book&edit=datetime`);
            }}
            color={color}
          />
          <Row
            label="Time"
            value={formatTime(defaults.booking_time)}
            onEdit={() => {
              seedSessionForEdit();
              router.push(`/${slug}/book?from=quick-book&edit=datetime`);
            }}
            color={color}
          />

          {/* Staff */}
          <Row
            label="Provider"
            value={staffName}
            onEdit={() => {
              seedSessionForEdit();
              router.push(`/${slug}/book?from=quick-book&edit=staff`);
            }}
            color={color}
            warn={staffUnavailable}
          />

          {/* Add-ons */}
          {defaults.addons.length > 0 ? (
            <Row
              label="Add-ons"
              value={defaults.addons.filter(a => defaults.addon_ids.includes(a.id)).map(a => a.name).join(", ") || "None"}
              sub={addonTotal > 0 ? `+$${(addonTotal / 100).toFixed(2)}` : undefined}
              onEdit={() => {
                seedSessionForEdit();
                router.push(`/${slug}/addons?from=quick-book`);
              }}
              color={color}
            />
          ) : isCarwash ? (
            <Row
              label="Add-ons"
              value="None"
              onEdit={() => {
                seedSessionForEdit();
                router.push(`/${slug}/addons?from=quick-book`);
              }}
              color={color}
            />
          ) : null}

          {/* Vehicle (car wash only) */}
          {isCarwash && (
            <Row
              label="Vehicle"
              value={defaults.vehicle_type ? vehicleLabels[defaults.vehicle_type] || defaults.vehicle_type : "Not set"}
              sub={defaults.vehicle_condition ? conditionLabels[defaults.vehicle_condition] : undefined}
              onEdit={() => {
                seedSessionForEdit();
                router.push(`/${slug}/vehicle?from=quick-book`);
              }}
              color={color}
            />
          )}

          {/* Total */}
          <div className="px-5 py-4 bg-gray-50 flex justify-between items-center">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-xl" style={{ color }}>${(totalPriceCents / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Next appointment preview */}
        {nextDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <span className="font-semibold">Next booking: </span>
            {new Date(nextDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {" at "}{formatTime(defaults.booking_time)}
          </div>
        )}

        {!nextDate && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            Your usual day ({capitalize(defaults.booking_day_of_week)}) is not currently available. Please edit the day/time.
          </div>
        )}

        {bookError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {bookError}
          </div>
        )}
      </div>

      {/* Book It button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleBookIt}
          disabled={booking || !nextDate || staffUnavailable}
          className="w-full py-4 rounded-xl text-white font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: color }}
        >
          {booking ? "Booking..." : "Book It ⚡"}
        </button>
        {staffUnavailable && (
          <p className="text-center text-xs text-orange-600 mt-2">
            Edit the provider or time above before booking
          </p>
        )}
      </div>

      {/* Pending Edits Modal — one-time or save as default? */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Save this change?</h3>
            <p className="text-gray-600 text-sm mb-5">
              Would you like to use this change just for the upcoming booking, or save it as your new Quick Book default?
            </p>
            <div className="space-y-3">
              <button
                onClick={applyEditsAsDefault}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ backgroundColor: color }}
              >
                Save as New Default
              </button>
              <button
                onClick={applyEditsOneTime}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-800 font-semibold"
              >
                One-Time Change
              </button>
              <button
                onClick={clearPendingEdits}
                className="w-full py-3 rounded-xl text-gray-500 text-sm"
              >
                Discard Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────
function Row({
  label, value, sub, onEdit, color, warn,
}: {
  label: string;
  value: string;
  sub?: string;
  onEdit: () => void;
  color: string;
  warn?: boolean;
}) {
  return (
    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`font-semibold mt-0.5 ${warn ? "text-orange-600" : "text-gray-900"}`}>{value}</p>
        {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={onEdit}
        className="ml-4 text-sm font-semibold px-3 py-1.5 rounded-lg transition"
        style={{ color, backgroundColor: `${color}15` }}
      >
        Edit
      </button>
    </div>
  );
}
