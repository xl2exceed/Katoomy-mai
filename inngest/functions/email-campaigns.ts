import { inngest } from "@/lib/inngest";

export const emailCampaigns = inngest.createFunction(
  { id: "email-campaigns", name: "Email Campaigns", retries: 2, triggers: [{ cron: "0 9 * * *" }] },
  async ({ step }) => {
    return step.run("run-email-campaigns", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
      const res = await fetch(`${baseUrl}/api/cron/email-campaigns`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`email-campaigns failed with status ${res.status}`);
      return res.json();
    });
  },
);
