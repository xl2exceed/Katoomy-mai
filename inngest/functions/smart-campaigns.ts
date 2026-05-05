import { inngest } from "@/lib/inngest";

export const smartCampaigns = inngest.createFunction(
  { id: "smart-campaigns", name: "Smart Campaigns", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    return step.run("run-smart-campaigns", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
      const res = await fetch(`${baseUrl}/api/cron/smart-campaigns`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`smart-campaigns failed with status ${res.status}`);
      return res.json();
    });
  },
);
