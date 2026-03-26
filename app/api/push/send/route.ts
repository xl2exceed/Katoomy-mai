// file: app/api/push/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushNotification, PushPayload } from "@/lib/webpush";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetType, targetId, payload } = body as {
      targetType: "customer" | "business" | "staff";
      targetId: string;
      payload: PushPayload;
    };

    if (!targetType || !targetId || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Use admin client so subscriptions are always readable regardless of which
    // portal triggers the send (staff uses localStorage auth, not cookies).
    const column =
      targetType === "customer" ? "customer_id" :
      targetType === "staff" ? "staff_id" :
      "business_id";

    const { data: subscriptions, error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq(column, targetId)
      .eq("user_type", targetType);

    if (subErr) {
      console.error("push/send: failed to fetch subscriptions", subErr);
    }

    const expiredEndpoints: string[] = [];
    let sent = 0;

    if (subscriptions && subscriptions.length > 0) {
      await Promise.all(
        subscriptions.map(async (sub) => {
          const result = await sendPushNotification(sub, payload);
          if (result.success) {
            sent++;
          } else if (result.expired) {
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error("push/send: delivery failed", result.error);
          }
        }),
      );

      if (expiredEndpoints.length > 0) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .in("endpoint", expiredEndpoints);
      }
    }

    // Log the notification -- wrapped in try/catch so logging never blocks delivery
    try {
      const logEntry: Record<string, unknown> = {
        target_type: targetType === "staff" ? "business" : targetType,
        title: payload.title,
        body: payload.body,
        url: payload.url || null,
        read: false,
      };

      if (targetType === "customer") {
        logEntry.customer_id = targetId;
        const { data: sub } = await supabaseAdmin
          .from("push_subscriptions")
          .select("business_id")
          .eq("customer_id", targetId)
          .limit(1)
          .maybeSingle();
        if (sub?.business_id) logEntry.business_id = sub.business_id;
      } else if (targetType === "staff") {
        const { data: staffRow } = await supabaseAdmin
          .from("staff")
          .select("business_id")
          .eq("id", targetId)
          .maybeSingle();
        if (staffRow?.business_id) logEntry.business_id = staffRow.business_id;
      } else {
        logEntry.business_id = targetId;
      }

      await supabaseAdmin.from("notification_log").insert(logEntry);
    } catch (logErr) {
      console.error("Notification log error (non-fatal):", logErr);
    }

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
