import { inngest } from "@/lib/inngest";

export const sendReminders = inngest.createFunction(
  { id: "send-reminders", name: "Push Notification Reminders", retries: 2, triggers: [{ cron: "*/10 * * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/notifications/send-reminders`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
