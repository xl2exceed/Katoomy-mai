"use client";

import { useEffect, useState } from "react";
import { createStaffClient } from "@/lib/supabase/staff-client";

interface Props {
  staffId: string;
}

const PUSH_ASKED_KEY = "katoomy:staffPushAsked";

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

async function subscribe(staffId: string, vapidKey: string, accessToken: string) {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ subscription, userType: "staff", staffId }),
  });
}

export default function StaffPushPermissionPrompt({ staffId }: Props) {
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const check = async () => {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const supabase = createStaffClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      if (Notification.permission === "granted" && vapidKey) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!existing) {
          try {
            await subscribe(staffId, vapidKey, session.access_token);
          } catch (err) {
            console.error("Silent staff push resubscribe failed:", err);
          }
        }
        return;
      }

      if (
        localStorage.getItem(PUSH_ASKED_KEY) === "1" ||
        Notification.permission !== "default"
      ) {
        return;
      }

      setTimeout(() => setShow(true), 2000);
    };

    check();
  }, [staffId]);

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

      const supabase = createStaffClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      await subscribe(staffId, vapidKey, session.access_token);
      localStorage.setItem(PUSH_ASKED_KEY, "1");
      setShow(false);
    } catch (err) {
      console.error("Staff push subscription error:", err);
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
              Get notified when you receive new appointments.
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
