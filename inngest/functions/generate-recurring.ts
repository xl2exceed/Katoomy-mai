import { inngest } from "@/lib/inngest";

export const generateRecurring = inngest.createFunction(
  { id: "generate-recurring", name: "Generate Recurring Bookings", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    return step.run("generate-recurring-bookings", async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
      const res = await fetch(`${baseUrl}/api/cron/generate-recurring`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`generate-recurring failed with status ${res.status}`);
      return res.json();
    });
  },
);
