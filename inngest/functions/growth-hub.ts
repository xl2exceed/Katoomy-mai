import { inngest } from "@/lib/inngest";

export const growthHub = inngest.createFunction(
  { id: "growth-hub", name: "Growth Hub Daily Campaigns", retries: 2, triggers: [{ cron: "0 9 * * *" }] },
  async ({ step }) => {
    return step.run("run-growth-hub", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
      const res = await fetch(`${baseUrl}/api/cron/growth-hub`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`growth-hub failed with status ${res.status}`);
      return res.json();
    });
  },
);
