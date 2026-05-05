import { inngest } from "@/lib/inngest";

export const monthlyBilling = inngest.createFunction(
  { id: "monthly-billing", name: "Monthly Platform Billing", retries: 2, triggers: [{ cron: "0 9 1 * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/monthly-billing`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
