import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const { businessSlug, referralCode } = await req.json();

    if (!businessSlug || !referralCode) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("slug", businessSlug)
      .single();

    if (bErr || !business) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const { data: ref, error: rErr } = await supabase
      .from("referral")
      .select("id, code, business_id")
      .eq("business_id", business.id)
      .eq("code", referralCode)
      .single();

    if (rErr || !ref) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // Optional log insert here

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
