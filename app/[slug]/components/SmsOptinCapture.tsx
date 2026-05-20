"use client";
import { useState } from "react";

interface Props {
  customerId: string;
  businessId: string;
  businessSlug: string;
  businessName: string;
  variant: 1 | 2 | 3;
}

const COPY: Record<1 | 2 | 3, { title: string; body: string; cta: string }> = {
  1: {
    title: "Get appointment reminders 🔔",
    body: "One tap and we'll text you a reminder before every appointment — plus instant booking confirmations. No more wondering if you're confirmed.",
    cta: "Yes, text me",
  },
  2: {
    title: "Join the VIP text list ⚡",
    body: "When a cancellation opens up or an exclusive deal drops, SMS subscribers hear first — before anyone else. Tap in to never miss out.",
    cta: "Add me to the list",
  },
  3: {
    title: "Last chance for text alerts 💬",
    body: "This is the last time we'll ask. Enable text reminders and we'll make sure you never miss an appointment. Reply STOP any time to opt out instantly.",
    cta: "Yes, enable texts",
  },
};

export default function SmsOptinCapture({ customerId, businessId, businessSlug, businessName, variant }: Props) {
  const [state, setState] = useState<"idle" | "confirming" | "done" | "error">("confirming");
  const copy = COPY[variant];

  const handleConfirm = async () => {
    setState("idle");
    try {
      const res = await fetch("/api/customers/sms-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, businessId }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  const handleDismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("sms_optin");
    url.searchParams.delete("cid");
    url.searchParams.delete("v");
    window.history.replaceState({}, "", url.toString());
    setState("done");
  };

  if (state === "done") return null;

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "16px" }}>
      <div style={{
        maxWidth: 480,
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        padding: "20px 24px",
      }}>
        {state === "confirming" && (
          <>
            <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#111827" }}>
              {copy.title}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#059669" }}>
              {businessName}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
              {copy.body} Reply STOP any time to opt out.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: "12px 0", background: "#059669", color: "#fff",
                  fontWeight: 700, fontSize: 15, borderRadius: 10, border: "none", cursor: "pointer",
                }}
              >
                {copy.cta}
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: "12px 16px", background: "#f3f4f6", color: "#374151",
                  fontWeight: 600, fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer",
                }}
              >
                No thanks
              </button>
            </div>
          </>
        )}
        {state === "idle" && (
          <p style={{ margin: 0, fontSize: 14, color: "#6b7280", textAlign: "center" }}>Saving your preference…</p>
        )}
        {state === "error" && (
          <p style={{ margin: 0, fontSize: 14, color: "#dc2626", textAlign: "center" }}>
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
