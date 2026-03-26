import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type InboundSimBody = {
  from?: string;
  to?: string;
  body?: string;
  business_id?: string | null; // optional
};

export async function POST(req: Request) {
  try {
    const { from, to, body, business_id } =
      (await req.json()) as InboundSimBody;

    if (!from || !to || !body) {
      return NextResponse.json(
        { ok: false, error: "Missing from/to/body" },
        { status: 400 },
      );
    }

    const insertPayload = {
      business_id: business_id ?? null,
      direction: "inbound",
      from_number: from,
      to_number: to,
      body,
      provider: "twilio",
      provider_message_id: null,
      status: "received",
    } as const;

    const { data, error } = await supabaseAdmin
      .from("sms_messages")
      .insert(insertPayload)
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      db: { ok: true, id: data.id, created_at: data.created_at },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
