// PATCH /api/recurring/[id]/customer-action
// Body: { customerId, action: "pause" | "resume" | "cancel" }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { customerId, action } = body;

  if (!customerId || !action)
    return NextResponse.json({ error: "customerId and action required" }, { status: 400 });
  if (!["pause", "resume", "cancel"].includes(action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("recurring_schedules")
    .select("id, status")
    .eq("id", id)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const newStatus =
    action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";

  const { data, error } = await supabaseAdmin
    .from("recurring_schedules")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status, frequency, day_of_week, preferred_time, next_booking_date")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
