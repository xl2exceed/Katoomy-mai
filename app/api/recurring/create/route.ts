// POST /api/recurring/create
// Creates a recurring schedule tied to a just-confirmed booking.
// Called from the customer-info page after a successful booking.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function nextOccurrence(date: Date, frequency: string): Date {
  const d = new Date(date);
  if (frequency === "weekly")   d.setDate(d.getDate() + 7);
  if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  if (frequency === "monthly")  d.setMonth(d.getMonth() + 1);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const {
      businessId,
      customerId,
      serviceId,
      frequency,
      preferredTime,
      firstBookingDate, // 'YYYY-MM-DD' — the date the customer just booked
      propertySize,
      priceCents,
      addonIds = [],
      notes,
    }: {
      businessId: string;
      customerId: string;
      serviceId: string;
      frequency: "weekly" | "biweekly" | "monthly";
      preferredTime: string;
      firstBookingDate: string;
      propertySize?: string;
      priceCents: number;
      addonIds?: string[];
      notes?: string;
    } = await req.json();

    if (!businessId || !customerId || !serviceId || !frequency || !preferredTime || !firstBookingDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validFrequencies = ["weekly", "biweekly", "monthly"];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }

    // day_of_week from the first booking date
    const firstDate = new Date(`${firstBookingDate}T00:00:00`);
    const dayOfWeek = firstDate.getDay();

    // next_booking_date is the occurrence AFTER the first booking
    const nextDate = nextOccurrence(firstDate, frequency);
    const nextBookingDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabaseAdmin
      .from("recurring_schedules")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        service_id: serviceId,
        frequency,
        preferred_time: preferredTime,
        day_of_week: dayOfWeek,
        property_size: propertySize ?? null,
        price_cents: priceCents,
        addon_ids: addonIds,
        status: "active",
        next_booking_date: nextBookingDate,
        notes: notes ?? null,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ scheduleId: data.id, nextBookingDate });
  } catch (err) {
    console.error("recurring/create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
