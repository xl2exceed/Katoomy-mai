import { inngest } from "@/lib/inngest";

export const smartCampaigns = inngest.createFunction(
  { id: "smart-campaigns", name: "Smart Campaigns", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/smart-campaigns`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
