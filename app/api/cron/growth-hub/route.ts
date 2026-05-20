// Deprecated — legacy Growth Hub win-back/referral/social cron.
// These campaigns are now handled by the Smart Campaigns cron (/api/cron/smart-campaigns).
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ message: "Deprecated. Use /api/cron/smart-campaigns." }, { status: 410 });
}
