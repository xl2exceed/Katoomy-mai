import { inngest } from "@/lib/inngest";

export const runDue = inngest.createFunction(
  { id: "run-due", name: "SMS Appointment Reminders", retries: 2, triggers: [{ cron: "*/5 * * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/sms/run-due`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
