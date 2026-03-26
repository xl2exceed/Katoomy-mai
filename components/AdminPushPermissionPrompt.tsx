"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminPushPermissionPromptProps {
  businessId: string;
}

const PUSH_ASKED_KEY = "katoomy:adminPushAsked";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeAdmin(businessId: string, vapidKey: string, accessToken: string) {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ subscription, userType: "business", businessId }),
  });
  if (!res.ok) throw new Error(`Subscribe API returned ${res.status}`);
}

export default function AdminPushPermissionPrompt({
  businessId,
}: AdminPushPermissionPromptProps) {
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const check = async () => {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // If already granted, silently resubscribe if the subscription is gone
      if (Notification.permission === "granted" && vapidKey) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!existing) {
          try {
            await subscribeAdmin(businessId, vapidKey, session.access_token);
          } catch (err) {
            console.error("Silent push resubscribe failed:", err);
          }
        }
        return;
      }

      // Not yet asked -- show prompt after delay
      if (
        localStorage.getItem(PUSH_ASKED_KEY) === "1" ||
        Notification.permission !== "default"
      ) {
        return;
      }

      setTimeout(() => setShow(true), 2000);
    };

    check();
  }, [businessId]);

  const handleAllow = async () => {
    setSubscribing(true);
    setError("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        localStorage.setItem(PUSH_ASKED_KEY, "1");
        setShow(false);
        setSubscribing(false);
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("VAPID key not configured");

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      await subscribeAdmin(businessId, vapidKey, session.access_token);

      // Only mark asked AFTER successful subscription
      localStorage.setItem(PUSH_ASKED_KEY, "1");
      setShow(false);
    } catch (err) {
      console.error("Admin push subscription error:", err);
      setError("Something went wrong. Try again.");
    }

    setSubscribing(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(PUSH_ASKED_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="max-w-md mx-auto bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center text-xl flex-shrink-0">
            🔔
          </div>
          <div>
            <p className="font-bold text-white">New booking alerts</p>
            <p className="text-sm text-gray-400 mt-0.5">
              Get notified instantly when customers book or cancel appointments.
            </p>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-400 font-semibold text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleAllow}
            disabled={subscribing}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-60"
          >
            {subscribing ? "Setting up..." : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}
