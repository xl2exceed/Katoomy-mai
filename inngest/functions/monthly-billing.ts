import { inngest } from "@/lib/inngest";

export const monthlyBilling = inngest.createFunction(
  { id: "monthly-billing", name: "Monthly Platform Billing", retries: 2, triggers: [{ cron: "0 9 1 * *" }] },
  async ({ step }) => {
    return step.run("run-monthly-billing", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
      const res = await fetch(`${baseUrl}/api/cron/monthly-billing`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`monthly-billing failed with status ${res.status}`);
      return res.json();
    });
  },
);
