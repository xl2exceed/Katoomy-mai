"use client";

import { useEffect, useState } from "react";

interface PushPermissionPromptProps {
  customerId: string;
  primaryColor?: string;
}

const PUSH_ASKED_KEY = "katoomy:pushAsked";

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

async function saveSubscription(customerId: string, subscription: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, userType: "customer", customerId }),
  });
  if (!res.ok) throw new Error(`Subscribe API returned ${res.status}`);
}

export default function PushPermissionPrompt({
  customerId,
  primaryColor = "#3B82F6",
}: PushPermissionPromptProps) {
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const check = async () => {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      // Already granted -- silently re-subscribe if subscription expired
      if (Notification.permission === "granted" && vapidKey) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          if (!existing) {
            const subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            });
            await saveSubscription(customerId, subscription);
          }
        } catch (err) {
          console.error("Silent customer push resubscribe failed:", err);
        }
        return;
      }

      // Not yet asked -- show the prompt after a short delay
      if (
        localStorage.getItem(PUSH_ASKED_KEY) === "1" ||
        Notification.permission !== "default"
      ) {
        return;
      }

      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    };

    check();
  }, [customerId]);

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

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("VAPID key not configured");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await saveSubscription(customerId, subscription);

      localStorage.setItem(PUSH_ASKED_KEY, "1");
      setShow(false);
    } catch (err) {
      console.error("Push subscription error:", err);
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
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            🔔
          </div>
          <div>
            <p className="font-bold text-gray-900">Stay in the loop</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Get notified when your appointment is confirmed or when it&apos;s
              time to come in.
            </p>
          </div>
        </div>
        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleAllow}
            disabled={subscribing}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            {subscribing ? "Setting up..." : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}
