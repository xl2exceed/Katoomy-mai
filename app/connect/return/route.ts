import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe sends users here after onboarding finishes.
 * We:
 *  1) call our internal sync endpoint to update Supabase
 *  2) redirect the user back to the payments/settings page
 *
 * IMPORTANT: This is a Route Handler, not a Page, so it won't be prerendered.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");

  const origin = url.origin;

  if (!businessId) {
    return NextResponse.redirect(
      new URL("/admin/stripe?error=missing_business_id", origin),
    );
  }

  // Call your sync route to update stripe_connect_accounts in Supabase
  try {
    const syncUrl = new URL("/api/stripe/connect/sync", origin);

    const res = await fetch(syncUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });

    if (!res.ok) {
      return NextResponse.redirect(
        new URL("/admin/stripe?sync=failed", origin),
      );
    }
  } catch {
    return NextResponse.redirect(new URL("/admin/stripe?sync=failed", origin));
  }

  return NextResponse.redirect(new URL("/admin/stripe?sync=ok", origin));
}
