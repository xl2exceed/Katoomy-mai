import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { smartCampaigns } from "@/inngest/functions/smart-campaigns";
import { billBusinesses } from "@/inngest/functions/bill-businesses";
import { resolvePaymentReports } from "@/inngest/functions/resolve-payment-reports";
import { autoMarkIncomplete } from "@/inngest/functions/auto-mark-incomplete";
import { growthHub } from "@/inngest/functions/growth-hub";
import { monthlyBilling } from "@/inngest/functions/monthly-billing";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    smartCampaigns,
    billBusinesses,
    resolvePaymentReports,
    autoMarkIncomplete,
    growthHub,
    monthlyBilling,
  ],
});
