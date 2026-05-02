// POST /api/admin/set-billing-interval
// Platform-owner-only endpoint (secured by CRON_SECRET) to update a
// business's billing interval and recalculate their next billing date.
//
// Body: { businessId: string, interval: "weekly" | "bi-weekly" | "monthly" }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VALID_INTERVALS = ["weekly", "bi-weekly", "monthly"] as const;
type BillingInterval = typeof VALID_INTERVALS[number];

function nextBillingDate(from: Date, interval: BillingInterval): string {
  const d = new Date(from);
  if (interval === "weekly")     d.setDate(d.getDate() + 7);
  else if (interval === "bi-weekly") d.setDate(d.getDate() + 14);
  else                           d.setMonth(d.getMonth() + 1);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  // Secured by CRON_SECRET — only the platform owner calls this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId, interval } = await req.json();

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json(
      { error: `interval must be one of: ${VALID_INTERVALS.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, name, last_billed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Next billing date is relative to their last bill (or today if never billed)
  const from = biz.last_billed_at ? new Date(biz.last_billed_at) : new Date();
  const next = nextBillingDate(from, interval as BillingInterval);

  const { error } = await supabaseAdmin
    .from("businesses")
    .update({ billing_interval: interval, next_billing_date: next })
    .eq("id", businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    business: biz.name,
    billing_interval: interval,
    next_billing_date: next,
  });
}
