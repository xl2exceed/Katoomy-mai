"use client";
// Floating banner that appears when a customer submits an external payment claim.
// Subscribes to booking_payment_reports via Supabase real-time.
// Caller provides businessId and supabase client (works for both admin + staff contexts).

import { useEffect, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

interface PendingReport {
  id: string;
  booking_id: string;
  customer_id: string;
  payment_method: string;
  total_amount_cents: number;
  customer_response_at: string;
  // joined
  customerName?: string;
  customerPhone?: string;
  serviceName?: string;
  appointmentTs?: string;
}

interface Props {
  businessId: string;
  supabase: SupabaseClient;
  // Optional: Bearer token for staff auth on business-response API
  authToken?: string;
  // Called after Paid/Unpaid is confirmed so the parent can refresh its booking list
  onRespond?: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  cash_app: "Cash App",
  zelle: "Zelle",
  cash: "Cash",
};

export default function PaymentNotificationBanner({ businessId, supabase, authToken, onRespond }: Props) {
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  // Load any existing unresolved reports on mount
  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Real-time subscription
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`payment-reports-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_payment_reports",
          filter: `business_id=eq.${businessId}`,
        },
        () => { loadPending(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function loadPending() {
    const { data } = await supabase
      .from("booking_payment_reports")
      .select("id, booking_id, customer_id, payment_method, total_amount_cents, customer_response_at, customer_response, resolution_status, bookings(start_ts, services(name)), customers(full_name, phone)")
      .eq("business_id", businessId)
      .eq("customer_response", "paid")
      .eq("business_response", "pending")
      .eq("resolution_status", "pending")
      .order("customer_response_at", { ascending: true });

    if (!data) return;

    const reports: PendingReport[] = data.map((r) => {
      const bookingArr = r.bookings as unknown as { start_ts: string | null; services: { name: string } | null }[] | null;
      const customerArr = r.customers as unknown as { full_name: string | null }[] | null;
      return {
        id: r.id,
        booking_id: r.booking_id,
        customer_id: r.customer_id,
        payment_method: r.payment_method,
        total_amount_cents: r.total_amount_cents,
        customer_response_at: r.customer_response_at,
        customerName: (Array.isArray(customerArr) ? customerArr[0]?.full_name : null) ?? "Customer",
        customerPhone: (Array.isArray(customerArr) ? customerArr[0]?.phone : null) ?? undefined,
        serviceName: (Array.isArray(bookingArr) ? bookingArr[0]?.services?.name : null) ?? undefined,
        appointmentTs: (Array.isArray(bookingArr) ? bookingArr[0]?.start_ts : null) ?? undefined,
      };
    });

    setPending(reports);
  }

  async function respond(reportId: string, response: "paid" | "unpaid") {
    setActing(reportId);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    await fetch("/api/payment-reports/business-response", {
      method: "POST",
      headers,
      body: JSON.stringify({ reportId, response }),
    });

    setPending((prev) => prev.filter((r) => r.id !== reportId));
    setActing(null);
    onRespond?.();
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4">
      {pending.map((report) => (
        <div
          key={report.id}
          className="bg-white border-2 border-indigo-400 rounded-2xl shadow-xl p-4 animate-in slide-in-from-bottom-2"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-bold text-gray-900">💰 Payment Claimed</p>
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
              {METHOD_LABELS[report.payment_method] ?? report.payment_method}
            </span>
          </div>

          {/* Customer + appointment details */}
          <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 space-y-0.5">
            <p className="text-sm font-semibold text-gray-900">{report.customerName}</p>
            {report.customerPhone && (
              <p className="text-xs text-gray-500">{report.customerPhone}</p>
            )}
            {report.serviceName && (
              <p className="text-xs text-gray-600">{report.serviceName}</p>
            )}
            {report.appointmentTs && (
              <p className="text-xs text-gray-500">
                Appt: {new Date(report.appointmentTs).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" at "}
                {new Date(report.appointmentTs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>

          <p className="text-lg font-bold text-gray-900 mb-3">
            ${(report.total_amount_cents / 100).toFixed(2)}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => respond(report.id, "paid")}
              disabled={acting === report.id}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition"
            >
              {acting === report.id ? "..." : "✓ Paid"}
            </button>
            <button
              onClick={() => respond(report.id, "unpaid")}
              disabled={acting === report.id}
              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition"
            >
              {acting === report.id ? "..." : "✗ Unpaid"}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            Tapping Paid confirms receipt and records payment
          </p>
        </div>
      ))}
    </div>
  );
}
