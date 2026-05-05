import { inngest } from "@/lib/inngest";

export const billBusinesses = inngest.createFunction(
  { id: "bill-businesses", name: "Bill Businesses", retries: 2, triggers: [{ cron: "0 0 * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/bill-businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
    return res.json();
  }
);
