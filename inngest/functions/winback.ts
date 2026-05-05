import { inngest } from "@/lib/inngest";

export const winback = inngest.createFunction(
  { id: "winback", name: "Win-back Campaigns", retries: 2, triggers: [{ cron: "0 8 * * *" }] },
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://katoomy.com";
    const res = await fetch(`${baseUrl}/api/growth/winback?run=auto`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    return res.json();
  }
);
