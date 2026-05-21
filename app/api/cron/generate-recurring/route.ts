// GET /api/cron/generate-recurring
// Daily cron — runs every morning.
// Finds active recurring schedules due within the next 3 days and creates bookings.
// Auth: Authorization: Bearer <CRON_SECRET>
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextOccurrence(dateStr: string, frequency: string): string {
  if (frequency === "weekly")   return addDays(dateStr, 7);
  if (frequency === "biweekly") return addDays(dateStr, 14);
  if (frequency === "monthly")  return addMonths(dateStr, 1);
  return addDays(dateStr, 7);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "katoomy-cron-2026-1ZXCVBNM";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all active schedules due within the next 3 days
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + 3);
  const horizonStr = `${horizonDate.getFullYear()}-${String(horizonDate.getMonth() + 1).padStart(2, "0")}-${String(horizonDate.getDate()).padStart(2, "0")}`;

  const { data: schedules, error: fetchError } = await supabaseAdmin
    .from("recurring_schedules")
    .select(`
      id, business_id, customer_id, service_id, frequency,
      preferred_time, next_booking_date, price_cents, addon_ids,
      property_size, notes,
      services(duration_minutes, name),
      customers(full_name, phone),
      businesses(name, default_booking_status)
    `)
    .eq("status", "active")
    .lte("next_booking_date", horizonStr);

  if (fetchError) {
    console.error("[generate-recurring] fetch error:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!schedules?.length) {
    return NextResponse.json({ message: "No schedules due", created: 0 });
  }

  let created = 0;
  let failed = 0;
  const log: string[] = [];

  for (const schedule of schedules) {
    try {
      const service = (schedule.services as unknown as { duration_minutes: number; name: string } | null);
      const business = (schedule.businesses as unknown as { name: string; default_booking_status: string } | null);
      if (!service || !business) { failed++; continue; }

      const bookingDateStr = schedule.next_booking_date;
      const startISO = new Date(`${bookingDateStr}T${schedule.preferred_time}:00`).toISOString();
      const endISO = new Date(new Date(startISO).getTime() + service.duration_minutes * 60000).toISOString();

      // Avoid duplicate: check if a booking already exists for this schedule on this date
      const startOfDay = new Date(`${bookingDateStr}T00:00:00`).toISOString();
      const endOfDay   = new Date(`${bookingDateStr}T23:59:59`).toISOString();
      const { data: existing } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("business_id", schedule.business_id)
        .eq("customer_id", schedule.customer_id)
        .eq("service_id", schedule.service_id)
        .gte("start_ts", startOfDay)
        .lte("start_ts", endOfDay)
        .eq("recurring_schedule_id", schedule.id)
        .maybeSingle();

      if (existing) {
        // Already created — just advance next_booking_date
        await supabaseAdmin
          .from("recurring_schedules")
          .update({ next_booking_date: nextOccurrence(bookingDateStr, schedule.frequency), updated_at: new Date().toISOString() })
          .eq("id", schedule.id);
        log.push(`SKIP duplicate: schedule ${schedule.id} on ${bookingDateStr}`);
        continue;
      }

      // Create the booking
      const { error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          business_id: schedule.business_id,
          customer_id: schedule.customer_id,
          service_id: schedule.service_id,
          start_ts: startISO,
          end_ts: endISO,
          price_cents: schedule.price_cents,
          status: business.default_booking_status || "confirmed",
          notes: schedule.notes ?? "Recurring booking",
          recurring_schedule_id: schedule.id,
          source: "recurring",
        });

      if (bookingError) {
        console.error(`[generate-recurring] booking insert error for schedule ${schedule.id}:`, bookingError);
        failed++;
        log.push(`FAIL: schedule ${schedule.id} — ${bookingError.message}`);
        continue;
      }

      // Advance next_booking_date
      await supabaseAdmin
        .from("recurring_schedules")
        .update({
          next_booking_date: nextOccurrence(bookingDateStr, schedule.frequency),
          last_booking_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      created++;
      log.push(`OK: schedule ${schedule.id} → booking on ${bookingDateStr}`);
    } catch (err) {
      failed++;
      console.error(`[generate-recurring] unexpected error for schedule ${schedule.id}:`, err);
      log.push(`ERROR: schedule ${schedule.id} — ${err}`);
    }
  }

  console.log(`[generate-recurring] Done. Created: ${created}, Failed: ${failed}`);
  return NextResponse.json({ created, failed, total: schedules.length, log });
}
