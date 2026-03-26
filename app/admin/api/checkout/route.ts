import { NextResponse } from "next/server";

export const runtime = "nodejs"; // safe default if you later use Stripe/Twilio server SDKs

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Not implemented yet" },
    { status: 501 },
  );
}

// Optional: block GET to avoid confusion
export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
