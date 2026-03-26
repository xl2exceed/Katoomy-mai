// lib/utils/sendPush.ts
// Client-side helper to fire push notifications via API

import { PushPayload } from "@/lib/webpush";

export async function sendPush(
  targetType: "customer" | "business" | "staff",
  targetId: string,
  payload: PushPayload,
) {
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, payload }),
    });
  } catch (err) {
    console.error("sendPush error:", err);
  }
}
