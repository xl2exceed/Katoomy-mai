import { inngest } from "@/lib/inngest";

export const resolvePaymentReports = inngest.createFunction(
  { id: "resolve-payment-reports", name: "Resolve Payment Reports", retries: 3, triggers: [{ cron: "*/30 * * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/cron/resolve-payment-reports`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    return res.json();
  }
);
