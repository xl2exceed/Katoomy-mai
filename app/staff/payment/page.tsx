"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createStaffClient as createClient } from "@/lib/supabase/staff-client";
import Link from "next/link";
import Image from "next/image";

interface ServiceItem {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

interface ExistingBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  depositPaidCents: number;
  date: string;
}

interface LookupResult {
  customerName: string | null;
  existingBooking: ExistingBooking | null;
  services: ServiceItem[];
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}

export default function StaffPaymentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [staffId, setStaffId] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerPhone, setCustomerPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/staff/login"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    setToken(session?.access_token || "");
    const { data: s } = await supabase.from("staff").select("id").eq("user_id", user.id).maybeSingle();
    if (!s) { router.push("/staff/login"); return; }
    setStaffId(s.id);
    setLoading(false);
  }

  function authHeaders(): Record<string, string> {
    return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
  }

  function handlePhoneChange(val: string) {
    const formatted = formatPhoneInput(val);
    setCustomerPhone(formatted);
    setLookup(null);
    setError("");
    const digits = val.replace(/\D/g, "");
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (digits.length === 10 && staffId) {
      lookupTimerRef.current = setTimeout(() => doLookup(digits), 400);
    }
  }

  async function doLookup(digits: string) {
    setLooking(true);
    try {
      const res = await fetch("/api/staff/lookup-customer", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ staffId, phone: digits }),
      });
      const data: LookupResult = await res.json();
      setLookup(data);
      setCustomerName(data.customerName || "");
      if (data.services.length > 0) setSelectedServiceId(data.services[0].id);
    } catch {
      setError("Lookup failed. Check your connection.");
    }
    setLooking(false);
  }

  async function submitPayment(mode: "card" | "cash") {
    setError("");
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a valid 10-digit phone number."); return; }
    if (!lookup?.existingBooking && !selectedServiceId) { setError("Select a service."); return; }
    const name = customerName.trim() || lookup?.customerName || "";
    if (!name) { setError("Enter the customer name."); return; }
    const serviceId = lookup?.existingBooking ? lookup.existingBooking.serviceId : selectedServiceId;
    setBusy(true);
    try {
      const res = await fetch("/api/staff/take-payment", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ staffId, mode, serviceId, customerName: name, customerPhone: digits }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setBusy(false); return; }
      if (mode === "card") {
        setQrUrl(data.bookingUrl || data.url);
      } else {
        reset();
        alert("Cash payment recorded.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  function reset() {
    setQrUrl(""); setCustomerPhone(""); setCustomerName(""); setSelectedServiceId(""); setLookup(null); setError("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (qrUrl) {
    const eb = lookup?.existingBooking;
    const label = eb
      ? (eb.serviceName + " — $" + (eb.priceCents / 100).toFixed(2) + (eb.depositPaidCents > 0 ? " remaining" : ""))
      : (lookup?.services.find(s => s.id === selectedServiceId)?.name || "");
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">Back to Menu</Link>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <p className="font-semibold text-gray-900 text-lg mb-1">Have the customer scan to pay</p>
          {label && <p className="text-gray-600 text-sm mb-4">{label}</p>}
          <div className="flex justify-center mb-6">
            <Image
              src={"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(qrUrl)}
              alt="Payment QR Code" width={220} height={220}
              className="rounded-lg border border-gray-200"
            />
          </div>
          <div className="text-left mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-1">Payment Link</p>
            <div className="p-2 bg-gray-50 rounded-lg break-all text-xs text-gray-700 mb-2 border border-gray-200">
              {qrUrl}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(qrUrl); alert("Link copied!"); }}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition text-sm"
            >
              📋 Copy Link
            </button>
          </div>
          <button onClick={reset} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">New Payment</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Link href="/staff/dashboard" className="text-emerald-600 font-medium mb-4 block">Back to Menu</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Take Payment</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Phone</label>
          <input
            type="tel" placeholder="(555) 123-4567" value={customerPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base text-gray-900 bg-white"
          />
        </div>

        {looking && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
            Looking up customer...
          </div>
        )}

        {lookup?.existingBooking && (
          <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 space-y-1">
            <p className="text-sm font-bold text-emerald-800">Customer found</p>
            <p className="text-base font-semibold text-gray-900">{lookup.customerName}</p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{lookup.existingBooking.serviceName}</span>
              {" · "}
              {new Date(lookup.existingBooking.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            {lookup.existingBooking.depositPaidCents > 0 ? (
              <div className="mt-1">
                <p className="text-lg font-bold text-orange-600">${(lookup.existingBooking.priceCents / 100).toFixed(2)} remaining</p>
                <p className="text-xs text-gray-500">Deposit paid: ${(lookup.existingBooking.depositPaidCents / 100).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-900">${(lookup.existingBooking.priceCents / 100).toFixed(2)} due</p>
            )}
            <p className="text-xs text-emerald-700">Payment will be applied to this booking.</p>
          </div>
        )}

        {lookup && !lookup.existingBooking && lookup.customerName !== null && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">Customer found</p>
            <p className="text-base font-semibold text-gray-900">{lookup.customerName}</p>
            <p className="text-xs text-gray-500 mt-0.5">No outstanding balance. A new booking record will be created.</p>
          </div>
        )}

        {lookup && lookup.customerName === null && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">New customer</p>
            <p className="text-xs text-amber-700 mt-0.5">Not in the system yet. A new record will be created.</p>
          </div>
        )}

        {lookup && !lookup.existingBooking && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name</label>
              <input
                type="text" placeholder="John Doe" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base text-gray-900 bg-white"
              />
            </div>
            {lookup.services.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Service</label>
                <select
                  value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base text-gray-900 bg-white"
                >
                  {lookup.services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — ${(s.price_cents / 100).toFixed(2)}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {lookup && (
          <div className="space-y-3 pt-1">
            <button onClick={() => submitPayment("card")} disabled={busy}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg disabled:opacity-60 active:scale-95 transition">
              {busy ? "Generating..." : "Generate QR Payment"}
            </button>
            <button onClick={() => submitPayment("cash")} disabled={busy}
              className="w-full py-3 bg-white text-gray-800 border-2 border-gray-300 rounded-xl font-semibold text-base disabled:opacity-60 active:scale-95 transition">
              Mark Cash Paid
            </button>
          </div>
        )}

        {!lookup && !looking && (
          <p className="text-xs text-gray-400 text-center">Enter the customer phone number to look them up</p>
        )}
      </div>
    </div>
  );
}
