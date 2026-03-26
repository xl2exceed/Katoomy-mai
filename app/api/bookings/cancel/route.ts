// file: app/api/bookings/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/webpush";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, customerId, businessId, customerName, startTs, apptTimeStr } =
      await req.json();

    if (!bookingId || !customerId || !businessId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { error, count } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" }, { count: "exact" })
      .eq("id", bookingId)
      .eq("customer_id", customerId);

    if (error) {
      console.error("Error cancelling booking:", error);
      return NextResponse.json(
        { error: "Failed to cancel booking", detail: error.message },
        { status: 500 },
      );
    }

    if (count === 0) {
      return NextResponse.json(
        {
          error: "Booking not found or already cancelled",
          bookingId,
          customerId,
        },
        { status: 404 },
      );
    }

    // Use pre-formatted string from browser (local timezone) to avoid Vercel UTC offset
    const apptTime = apptTimeStr || new Date(startTs).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const notificationTitle = "Appointment Cancelled";
    const notificationBody = `${customerName || "A customer"} cancelled their ${apptTime} appointment.`;
    const notificationUrl = "/admin/mobile/notifications";

    // Send push to business owner
    const { data: bizSubscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("business_id", businessId)
      .eq("user_type", "business");

    console.log(
      `Found ${bizSubscriptions?.length ?? 0} business subscriptions for businessId: ${businessId}`,
    );

    if (bizSubscriptions && bizSubscriptions.length > 0) {
      const expiredEndpoints: string[] = [];
      await Promise.all(
        bizSubscriptions.map(async (sub) => {
          const result = await sendPushNotification(sub, {
            title: notificationTitle,
            body: notificationBody,
            url: notificationUrl,
          });
          console.log("Push result:", result);
          if (!result.success && result.expired)
            expiredEndpoints.push(sub.endpoint);
        }),
      );
      if (expiredEndpoints.length > 0) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .in("endpoint", expiredEndpoints);
      }
    }

    // Always log the notification so it appears in the notifications page
    try {
      await supabaseAdmin.from("notification_log").insert({
        target_type: "business",
        business_id: businessId,
        title: notificationTitle,
        body: notificationBody,
        url: notificationUrl,
        read: false,
      });
    } catch (logErr) {
      console.error("Notification log error (non-fatal):", logErr);
    }

    // Send cancellation SMS to customer
    try {
      const [{ data: customer }, { data: biz }] = await Promise.all([
        supabaseAdmin.from("customers").select("phone").eq("id", customerId).single(),
        supabaseAdmin.from("businesses").select("name").eq("id", businessId).single(),
      ]);
      if (customer?.phone) {
        const bizName = biz?.name || "us";
        const smsBody = `Hi ${customerName || "there"}! Your ${apptTime} appointment has been cancelled. Contact ${bizName} to reschedule.`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (appUrl) {
          await fetch(`${appUrl}/api/sms/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: customer.phone, body: smsBody, business_id: businessId, customer_id: customerId }),
          });
        }
      }
    } catch (smsErr) {
      console.error("Cancellation SMS error (non-fatal):", smsErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cancel booking error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
