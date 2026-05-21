// PATCH /api/recurring/[id]
// Handles two cases:
//   1. Status change only: { status: "active" | "paused" | "cancelled" }
//   2. Schedule reschedule: { dayOfWeek, preferredTime, frequency }  (optionally with status)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Returns the next calendar date (YYYY-MM-DD) that falls on dayOfWeek (0=Sun).
// Always returns a future date (never today).
function nextDateForDay(dayOfWeek: number): string {
  const today = new Date();
  const todayDay = today.getDay();
  let daysUntil = dayOfWeek - todayDay;
  if (daysUntil <= 0) daysUntil += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify ownership
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Status update
  if (body.status !== undefined) {
    const validStatuses = ["active", "paused", "cancelled"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  // Schedule reschedule
  if (body.dayOfWeek !== undefined || body.preferredTime !== undefined || body.frequency !== undefined) {
    if (body.dayOfWeek !== undefined) {
      const dow = Number(body.dayOfWeek);
      if (dow < 0 || dow > 6) return NextResponse.json({ error: "Invalid dayOfWeek" }, { status: 400 });
      updates.day_of_week = dow;
      // Recalculate next_booking_date to the next occurrence of the new day
      updates.next_booking_date = nextDateForDay(dow);
    }
    if (body.preferredTime !== undefined) {
      updates.preferred_time = body.preferredTime;
    }
    if (body.frequency !== undefined) {
      const validFreqs = ["weekly", "biweekly", "monthly"];
      if (!validFreqs.includes(body.frequency)) {
        return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
      }
      updates.frequency = body.frequency;
    }
    // Reactivate if paused when rescheduling
    if (!body.status) updates.status = "active";
  }

  const { data, error } = await supabaseAdmin
    .from("recurring_schedules")
    .update(updates)
    .eq("id", id)
    .eq("business_id", biz.id)
    .select("id, status, day_of_week, preferred_time, frequency, next_booking_date")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
