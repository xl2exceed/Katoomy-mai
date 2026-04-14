"use client";

// app/booking-opt-in-demo/page.tsx
// 10DLC compliance demo — mirrors the real customer-info booking page exactly.
// No database connections. All data is static/local state only.

import { useState } from "react";

const BUSINESS_NAME = "Any Business Name";
const PRIMARY_COLOR = "#1D4ED8";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function BookingOptInDemoPage() {
  const [name, setName]                   = useState("");
  const [phone, setPhone]                 = useState("");
  const [email, setEmail]                 = useState("");
  const [notes, setNotes]                 = useState("");
  const [agreedToSms, setAgreedToSms]     = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"full" | "cash">("full");
  const [submitted, setSubmitted]         = useState(false);

  const serviceName    = "Haircut & Style";
  const priceCents     = 4500;
  const bookingDate    = "Saturday, April 19";
  const bookingTime    = "10:30 AM";
  const durationMins   = 45;

  const canSubmit = name.trim() && phone.replace(/\D/g, "").length === 10 && agreedToSms && agreedToPrivacy;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 text-sm mb-1">{serviceName}</p>
          <p className="text-gray-600 text-sm mb-4">{bookingDate} at {bookingTime}</p>
          <p className="text-gray-500 text-xs">
            A confirmation SMS will be sent to {phone}. Reply STOP at any time to opt out.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setName(""); setPhone(""); setEmail(""); setNotes("");
              setAgreedToSms(false); setAgreedToPrivacy(false);
              setPaymentChoice("full");
            }}
            className="mt-6 px-6 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: PRIMARY_COLOR }}
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_COLOR}DD 100%)` }}
      >
        <p className="text-white/70 text-xs mb-3 uppercase tracking-wide">Demo — 10DLC Opt-In Sample</p>
        <h1 className="text-2xl font-bold">{BUSINESS_NAME}</h1>
        <p className="text-white/90 mt-1">Your information</p>
      </div>

      <div className="p-6">
        {/* Booking Summary */}
        <div className="bg-green-600 rounded-xl shadow-lg border border-green-700 p-5 mb-6">
          <p className="text-sm font-medium text-green-100 uppercase tracking-wide mb-2">
            Your Appointment
          </p>
          <p className="text-xl font-bold text-white">{serviceName}</p>
          <div className="mt-3 pt-3 border-t border-green-500 space-y-1">
            <p className="text-white">{bookingDate}</p>
            <p className="text-white">{bookingTime} &nbsp;·&nbsp; {durationMins} min</p>
            <p className="text-2xl font-bold text-white mt-2">
              ${(priceCents / 100).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 555-5555"
              maxLength={14}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* SMS + Privacy consent */}
          <div className="space-y-3 py-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToSms}
                onChange={e => setAgreedToSms(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-600"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree to receive SMS text messages from Katoomy on behalf of {BUSINESS_NAME} including appointment reminders, booking confirmations, marketing and promotional offers. Message and data rates may apply. Message frequency varies. Reply STOP to opt out at any time. Reply HELP for help.{" "}
                <a href="/sms-terms" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  View our SMS Terms &amp; Conditions.
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToPrivacy}
                onChange={e => setAgreedToPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-600"
              />
              <span className="text-xs text-gray-600">
                I have read and agree to the{" "}
                <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  Privacy Policy
                </a>.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special requests or notes..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>

        {/* Payment Choice */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">How would you like to pay?</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPaymentChoice("full")}
              className={`w-full p-4 rounded-xl border-2 text-left transition ${
                paymentChoice === "full" ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">💳 Pay Full Amount Now</p>
                  <p className="text-sm text-gray-500">Secure payment via card</p>
                </div>
                <p className="font-bold text-gray-900">${(priceCents / 100).toFixed(2)}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentChoice("cash")}
              className={`w-full p-4 rounded-xl border-2 text-left transition ${
                paymentChoice === "cash" ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-gray-900">💵 Pay at Appointment</p>
                <p className="text-sm text-gray-500">Cash or card in person</p>
              </div>
            </button>
          </div>
        </div>

        <div className="h-32" />
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: PRIMARY_COLOR }}
        >
          Submit →
        </button>
      </div>
    </div>
  );
}
