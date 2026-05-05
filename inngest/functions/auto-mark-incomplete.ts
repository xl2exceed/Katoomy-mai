import { inngest } from "@/lib/inngest";

export const autoMarkIncomplete = inngest.createFunction(
  { id: "auto-mark-incomplete", name: "Auto Mark Incomplete Bookings", retries: 3, triggers: [{ cron: "0 * * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/auto-mark-incomplete`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
