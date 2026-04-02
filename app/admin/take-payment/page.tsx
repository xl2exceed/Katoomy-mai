"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

export default function AdminTakePaymentPage() {
  const router = useRouter();
  const supabase = createClient();

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

  // Custom payment state
  const [customServiceName, setCustomServiceName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customMethod, setCustomMethod] = useState("cash");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customSuccess, setCustomSuccess] = useState("");

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    setLoading(false);
  }

  function handlePhoneChange(val: string) {
    const formatted = formatPhoneInput(val);
    setCustomerPhone(formatted);
    setLookup(null);
    setError("");
    const digits = val.replace(/\D/g, "");
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (digits.length === 10) {
      lookupTimerRef.current = setTimeout(() => doLookup(digits), 400);
    }
  }

  async function doLookup(digits: string) {
    setLooking(true);
    try {
      const res = await fetch("/api/admin/lookup-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
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
      const res = await fetch("/api/admin/take-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, serviceId, customerName: name, customerPhone: digits }),
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

  async function submitCustomPayment() {
    setCustomError("");
    setCustomSuccess("");
    if (!customServiceName.trim()) { setCustomError("Enter a service or description."); return; }
    const amountCents = Math.round(parseFloat(customAmount) * 100);
    if (!amountCents || amountCents <= 0) { setCustomError("Enter a valid amount."); return; }
    setCustomBusy(true);
    try {
      const appointmentTs = new Date(`${customDate}T${customTime}`).toISOString();
      const res = await fetch("/api/admin/custom-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: customServiceName,
          amountCents,
          customerName: customCustomerName,
          paymentMethod: customMethod,
          appointmentTs,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCustomError(data.error || "Something went wrong."); setCustomBusy(false); return; }
      setCustomSuccess("Payment recorded successfully.");
      setCustomServiceName("");
      setCustomAmount("");
      setCustomCustomerName("");
      setCustomMethod("cash");
      const now = new Date();
      setCustomDate(now.toISOString().slice(0, 10));
      setCustomTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    } catch {
      setCustomError("Network error. Please try again.");
    }
    setCustomBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
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
        <button onClick={() => router.back()} className="text-purple-600 font-medium mb-4 block cursor-pointer">&#8592; Back</button>
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
          <button onClick={reset} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold">New Payment</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={() => router.back()} className="text-purple-600 font-medium mb-4 block cursor-pointer">&#8592; Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Take Payment</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Phone</label>
          <input
            type="tel" placeholder="(555) 123-4567" value={customerPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
          />
        </div>

        {looking && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
            Looking up customer...
          </div>
        )}

        {lookup?.existingBooking && (
          <div className="rounded-xl border-2 border-purple-500 bg-purple-50 p-4 space-y-1">
            <p className="text-sm font-bold text-purple-800">Customer found</p>
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
            <p className="text-xs text-purple-700">Payment will be applied to this booking.</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              />
            </div>
            {lookup.services.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Service</label>
                <select
                  value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
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
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold text-lg disabled:opacity-60 active:scale-95 transition">
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

      {/* ── Custom Payment ───────────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Custom Payment</h2>
        <p className="text-sm text-gray-500 mb-4">Record a one-off payment for any service or product not in the system.</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Service / Description <span className="text-red-500">*</span></label>
              <input
                type="text" placeholder="e.g. Haircut, Product sale…" value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number" inputMode="decimal" placeholder="0.00" value={customAmount} min="0" step="0.01"
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method</label>
              <select
                value={customMethod} onChange={(e) => setCustomMethod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="cashapp">Cash App</option>
                <option value="other">Zelle / Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name (optional)</label>
              <input
                type="text" placeholder="John Doe" value={customCustomerName}
                onChange={(e) => setCustomCustomerName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date" value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
              <input
                type="time" value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
              />
            </div>
          </div>

          {customError && <p className="text-red-600 text-sm">{customError}</p>}
          {customSuccess && <p className="text-green-600 text-sm font-semibold">{customSuccess}</p>}

          <button
            onClick={submitCustomPayment} disabled={customBusy}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-base disabled:opacity-60 active:scale-95 transition"
          >
            {customBusy ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
