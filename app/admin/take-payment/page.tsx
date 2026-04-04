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
  isCustom?: boolean;
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
  const [customTip, setCustomTip] = useState("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customMethod, setCustomMethod] = useState("cash");
  const [customQrUrl, setCustomQrUrl] = useState("");  // for credit card custom payments
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null);  // booking being paid via custom
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customSuccess, setCustomSuccess] = useState("");

  // Discount calculator state
  const [discountPrice, setDiscountPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("");

  // Calculator state
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcExpression, setCalcExpression] = useState("");
  const [calcPrevValue, setCalcPrevValue] = useState<number | null>(null);
  const [calcOperator, setCalcOperator] = useState<string | null>(null);
  const [calcWaiting, setCalcWaiting] = useState(false);

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
      // If the customer has a custom-status booking, pre-fill the custom payment form
      if (data.existingBooking?.isCustom) {
        setLinkedBookingId(data.existingBooking.id);
        setCustomServiceName(data.existingBooking.serviceName);
        setCustomAmount((data.existingBooking.priceCents / 100).toFixed(2));
        setCustomCustomerName(data.customerName || "");
      } else {
        setLinkedBookingId(null);
      }
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
    const tipCents = customTip ? Math.round(parseFloat(customTip) * 100) : 0;

    // Credit card: generate a Stripe QR link for the custom amount
    if (customMethod === "card") {
      setCustomBusy(true);
      try {
        const res = await fetch("/api/admin/custom-payment-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: customServiceName,
            amountCents,
            tipCents,
            customerName: customCustomerName,
            customerPhone: customerPhone.replace(/\D/g, ""),
            bookingId: linkedBookingId,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setCustomError(data.error || "Something went wrong."); setCustomBusy(false); return; }
        setCustomQrUrl(data.url);
      } catch {
        setCustomError("Network error. Please try again.");
      }
      setCustomBusy(false);
      return;
    }

    setCustomBusy(true);
    try {
      const appointmentTs = new Date(`${customDate}T${customTime}`).toISOString();
      const res = await fetch("/api/admin/custom-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: customServiceName,
          amountCents,
          tipCents,
          customerName: customCustomerName,
          customerPhone: customerPhone.replace(/\D/g, ""),
          paymentMethod: customMethod,
          appointmentTs,
          bookingId: linkedBookingId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCustomError(data.error || "Something went wrong."); setCustomBusy(false); return; }
      setCustomSuccess("Payment recorded successfully.");
      setCustomServiceName("");
      setCustomAmount("");
      setCustomTip("");
      setCustomCustomerName("");
      setCustomMethod("cash");
      setLinkedBookingId(null);
      const now = new Date();
      setCustomDate(now.toISOString().slice(0, 10));
      setCustomTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    } catch {
      setCustomError("Network error. Please try again.");
    }
    setCustomBusy(false);
  }

  function calcDigit(d: string) {
    if (calcWaiting) {
      setCalcDisplay(d === "." ? "0." : d);
      setCalcWaiting(false);
    } else {
      if (d === "." && calcDisplay.includes(".")) return;
      setCalcDisplay(calcDisplay === "0" && d !== "." ? d : calcDisplay + d);
    }
  }
  function calcOp(op: string) {
    const cur = parseFloat(calcDisplay);
    const sym = op === "*" ? "×" : op === "/" ? "÷" : op === "-" ? "−" : op;
    if (calcPrevValue !== null && calcOperator && !calcWaiting) {
      const res = applyCalcOp(calcPrevValue, cur, calcOperator);
      const resStr = fmtCalc(res);
      setCalcDisplay(resStr);
      setCalcExpression(resStr + " " + sym);
      setCalcPrevValue(res);
    } else {
      setCalcExpression(calcDisplay + " " + sym);
      setCalcPrevValue(cur);
    }
    setCalcOperator(op);
    setCalcWaiting(true);
  }
  function calcEquals() {
    const cur = parseFloat(calcDisplay);
    if (calcPrevValue !== null && calcOperator) {
      const res = applyCalcOp(calcPrevValue, cur, calcOperator);
      setCalcExpression(calcExpression + " " + calcDisplay + " =");
      setCalcDisplay(fmtCalc(res));
      setCalcPrevValue(null);
      setCalcOperator(null);
      setCalcWaiting(true);
    }
  }
  function calcPercent() {
    const cur = parseFloat(calcDisplay);
    if (calcPrevValue !== null && calcOperator === "*") {
      const res = calcPrevValue * (cur / 100);
      setCalcExpression(fmtCalc(calcPrevValue) + " × " + cur + "% =");
      setCalcDisplay(fmtCalc(res));
      setCalcPrevValue(null); setCalcOperator(null); setCalcWaiting(true);
    } else {
      setCalcDisplay(fmtCalc(cur / 100));
      setCalcWaiting(true);
    }
  }
  function calcClear() {
    setCalcDisplay("0"); setCalcExpression("");
    setCalcPrevValue(null); setCalcOperator(null); setCalcWaiting(false);
  }
  function calcBack() {
    if (calcWaiting) return;
    setCalcDisplay(calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : "0");
  }
  function applyCalcOp(a: number, b: number, op: string) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b !== 0 ? a / b : 0;
    return b;
  }
  function fmtCalc(n: number) {
    if (!isFinite(n) || isNaN(n)) return "0";
    return parseFloat(n.toFixed(10)).toString();
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tip (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number" inputMode="decimal" placeholder="0.00" value={customTip} min="0" step="0.01"
                  onChange={(e) => setCustomTip(e.target.value)}
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
                <option value="zelle">Zelle / Other</option>
                <option value="card">Credit Card</option>
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

          {linkedBookingId && (
            <div className="rounded-xl border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-800">
              <span className="font-semibold">Linked booking detected.</span> This payment will be applied to the customer&apos;s custom-status appointment and marked as paid.
            </div>
          )}

          {customQrUrl ? (
            <div className="text-center space-y-3">
              <p className="font-semibold text-gray-900">Have the customer scan to pay</p>
              <div className="flex justify-center">
                <img
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(customQrUrl)}
                  alt="Payment QR" width={200} height={200}
                  className="rounded-lg border border-gray-200"
                />
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(customQrUrl); alert("Link copied!"); }}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
              >
                📋 Copy Link
              </button>
              <button
                onClick={() => { setCustomQrUrl(""); setCustomSuccess(""); setCustomError(""); }}
                className="w-full py-2 bg-purple-600 text-white rounded-xl font-semibold text-sm"
              >
                New Custom Payment
              </button>
            </div>
          ) : (
            <>
              {customError && <p className="text-red-600 text-sm">{customError}</p>}
              {customSuccess && <p className="text-green-600 text-sm font-semibold">{customSuccess}</p>}
              <button
                onClick={submitCustomPayment} disabled={customBusy}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-base disabled:opacity-60 active:scale-95 transition"
              >
                {customBusy ? (customMethod === "card" ? "Generating..." : "Recording...") : (customMethod === "card" ? "Generate QR for Custom Amount" : "Record Payment")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Discount Calculator ──────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Discount Calculator</h2>
        <p className="text-sm text-gray-500 mb-4">Enter the original price and discount — see exactly what to charge.</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Original Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number" inputMode="decimal" placeholder="0.00" value={discountPrice} min="0" step="0.01"
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Discount %</label>
              <div className="relative">
                <input
                  type="number" inputMode="decimal" placeholder="15" value={discountPct} min="0" max="100" step="0.1"
                  onChange={(e) => setDiscountPct(e.target.value)}
                  className="w-full pl-4 pr-8 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base text-gray-900 bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
              </div>
            </div>
          </div>
          {(() => {
            const price = parseFloat(discountPrice);
            const pct = parseFloat(discountPct);
            if (!price || !pct || price <= 0 || pct <= 0 || pct > 100) return null;
            const savings = price * (pct / 100);
            const charge = price - savings;
            return (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Original price</span>
                  <span className="text-sm font-semibold text-gray-700">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">{pct}% discount</span>
                  <span className="text-sm font-semibold text-red-600">− ${savings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-purple-200 pt-3">
                  <span className="text-base font-bold text-gray-900">Charge customer</span>
                  <span className="text-2xl font-bold text-purple-700">${charge.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Calculator ───────────────────────────────────────────────── */}
      <div className="mt-8">
        <button
          onClick={() => setCalcOpen(!calcOpen)}
          className="w-full flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4"
        >
          <span className="text-lg font-bold text-gray-900">Calculator</span>
          <span className="text-gray-400 text-xl">{calcOpen ? "▲" : "▼"}</span>
        </button>
        {calcOpen && (
          <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-4">
            <div className="bg-gray-900 rounded-xl px-4 pt-3 pb-4 mb-3">
              <div className="text-gray-400 text-sm h-5 text-right truncate">{calcExpression || " "}</div>
              <div className="text-white text-4xl font-bold text-right mt-1 overflow-hidden">{calcDisplay}</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={calcClear} className="col-span-2 py-4 bg-red-50 text-red-700 rounded-xl font-bold text-lg active:scale-95 transition">C</button>
              <button onClick={calcBack} className="py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg active:scale-95 transition">⌫</button>
              <button onClick={() => calcOp("/")} className="py-4 bg-purple-100 text-purple-700 rounded-xl font-bold text-xl active:scale-95 transition">÷</button>

              <button onClick={() => calcDigit("7")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">7</button>
              <button onClick={() => calcDigit("8")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">8</button>
              <button onClick={() => calcDigit("9")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">9</button>
              <button onClick={() => calcOp("*")} className="py-4 bg-purple-100 text-purple-700 rounded-xl font-bold text-xl active:scale-95 transition">×</button>

              <button onClick={() => calcDigit("4")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">4</button>
              <button onClick={() => calcDigit("5")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">5</button>
              <button onClick={() => calcDigit("6")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">6</button>
              <button onClick={() => calcOp("-")} className="py-4 bg-purple-100 text-purple-700 rounded-xl font-bold text-xl active:scale-95 transition">−</button>

              <button onClick={() => calcDigit("1")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">1</button>
              <button onClick={() => calcDigit("2")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">2</button>
              <button onClick={() => calcDigit("3")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">3</button>
              <button onClick={() => calcOp("+")} className="py-4 bg-purple-100 text-purple-700 rounded-xl font-bold text-xl active:scale-95 transition">+</button>

              <button onClick={calcPercent} className="py-4 bg-blue-50 text-blue-700 rounded-xl font-bold text-lg active:scale-95 transition">%</button>
              <button onClick={() => calcDigit("0")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">0</button>
              <button onClick={() => calcDigit(".")} className="py-4 bg-gray-50 text-gray-900 rounded-xl font-semibold text-lg active:scale-95 transition">.</button>
              <button onClick={calcEquals} className="py-4 bg-purple-600 text-white rounded-xl font-bold text-xl active:scale-95 transition">=</button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">Tip: type price × percent % to calculate a discount (e.g. 33 × 15 %)</p>
          </div>
        )}
      </div>
    </div>
  );
}
