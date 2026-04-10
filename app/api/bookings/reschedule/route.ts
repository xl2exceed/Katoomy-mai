// POST /api/bookings/reschedule
// Updates an existing booking's time. Uses supabaseAdmin to bypass RLS
// since customers are not Supabase auth users.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, startISO, endISO } = await req.json();

    if (!bookingId || !startISO || !endISO) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        start_ts: startISO,
        end_ts: endISO,
        status: "confirmed",
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Reschedule error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reschedule error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}