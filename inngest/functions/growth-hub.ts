import { inngest } from "@/lib/inngest";

export const growthHub = inngest.createFunction(
  { id: "growth-hub", name: "Growth Hub Daily Campaigns", retries: 2, triggers: [{ cron: "0 9 * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/growth-hub`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
