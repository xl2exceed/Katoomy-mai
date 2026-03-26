// file: supabase/functions/booking-engine/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Deno types available at runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Booking {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  start_ts: string;
  end_ts: string;
  status: string;
  total_price_cents: number;
  deposit_required: boolean;
  deposit_amount_cents: number | null;
}

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  active: boolean;
}

interface AvailabilityRule {
  id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  buffer_minutes: number;
}

interface DepositSettings {
  business_id: string;
  enabled: boolean;
  type: string;
  amount_cents: number | null;
  percent: number | null;
}

interface LoyaltySettings {
  business_id: string;
  enabled: boolean;
  earn_on_booking: boolean;
  earn_on_completion: boolean;
  earn_on_referral: boolean;
  points_per_event: number;
  threshold_points: number;
  reward_type: string;
  reward_value: string;
}

interface Referral {
  id: string;
  business_id: string;
  referrer_customer_id: string;
  referred_customer_id: string;
  status: string;
  reward_issued: boolean;
}

interface BookingSlot {
  start_ts: string;
  end_ts: string;
}

interface TimeSlot {
  start: string;
  end: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "available_slots": {
        const { business_id, service_id, date } = await req.json();
        const slots = await getAvailableSlots(
          supabaseClient,
          business_id,
          service_id,
          date
        );
        return new Response(JSON.stringify({ slots }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_booking": {
        const { business_id, customer_id, service_id, start_ts } =
          await req.json();
        const booking = await createBooking(supabaseClient, {
          business_id,
          customer_id,
          service_id,
          start_ts,
        });
        return new Response(JSON.stringify(booking), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "complete_booking": {
        const { booking_id } = await req.json();
        await completeBooking(supabaseClient, booking_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel_booking": {
        const { booking_id } = await req.json();
        await cancelBooking(supabaseClient, booking_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getAvailableSlots(
  supabase: SupabaseClient,
  businessId: string,
  serviceId: string,
  date: string
): Promise<TimeSlot[]> {
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .single();

  if (!service) throw new Error("Service not found");

  const dayOfWeek = new Date(date).getDay();
  const { data: rules } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("business_id", businessId)
    .eq("day_of_week", dayOfWeek);

  if (!rules || rules.length === 0) return [];

  const rule = rules[0] as AvailabilityRule;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("start_ts, end_ts")
    .eq("business_id", businessId)
    .gte("start_ts", startOfDay.toISOString())
    .lte("start_ts", endOfDay.toISOString())
    .neq("status", "cancelled");

  const slots: TimeSlot[] = [];
  const startTime = new Date(`${date}T${rule.start_time}`);
  const endTime = new Date(`${date}T${rule.end_time}`);
  const slotDuration = service.duration_minutes + rule.buffer_minutes;

  let currentSlot = new Date(startTime);

  while (currentSlot < endTime) {
    const slotEnd = new Date(
      currentSlot.getTime() + service.duration_minutes * 60000
    );

    const isAvailable = !((bookings as BookingSlot[]) || []).some((booking) => {
      const bookingStart = new Date(booking.start_ts);
      const bookingEnd = new Date(booking.end_ts);
      return (
        (currentSlot >= bookingStart && currentSlot < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (currentSlot <= bookingStart && slotEnd >= bookingEnd)
      );
    });

    if (isAvailable && slotEnd <= endTime) {
      slots.push({
        start: currentSlot.toISOString(),
        end: slotEnd.toISOString(),
      });
    }

    currentSlot = new Date(currentSlot.getTime() + slotDuration * 60000);
  }

  return slots;
}

async function createBooking(
  supabase: SupabaseClient,
  params: {
    business_id: string;
    customer_id: string;
    service_id: string;
    start_ts: string;
  }
): Promise<Booking> {
  const { business_id, customer_id, service_id, start_ts } = params;

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", service_id)
    .single();

  if (!service) throw new Error("Service not found");

  const serviceData = service as Service;
  const endTs = new Date(
    new Date(start_ts).getTime() + serviceData.duration_minutes * 60000
  );

  const { data: depositSettings } = await supabase
    .from("deposit_settings")
    .select("*")
    .eq("business_id", business_id)
    .single();

  let depositRequired = false;
  let depositAmount = 0;

  if (depositSettings) {
    const settings = depositSettings as DepositSettings;
    if (settings.enabled) {
      depositRequired = true;
      if (settings.type === "flat" && settings.amount_cents) {
        depositAmount = settings.amount_cents;
      } else if (settings.type === "percent" && settings.percent) {
        depositAmount = Math.round(
          (serviceData.price_cents * settings.percent) / 100
        );
      }
    }
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id,
      customer_id,
      service_id,
      start_ts,
      end_ts: endTs.toISOString(),
      status: "requested",
      total_price_cents: serviceData.price_cents,
      deposit_required: depositRequired,
      deposit_amount_cents: depositAmount,
    })
    .select()
    .single();

  if (error) throw error;

  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_customer_id", customer_id)
    .eq("status", "account_created")
    .single();

  if (referral) {
    await supabase
      .from("referrals")
      .update({ status: "booked" })
      .eq("id", (referral as Referral).id);
  }

  return booking as Booking;
}

async function completeBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  const { data: booking } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (!booking) throw new Error("Booking not found");

  const bookingData = booking as Booking;

  
  // Get loyalty settings
  const { data: loyaltySettings } = await supabase
    .from("loyalty_settings")
    .select("*")
    .eq("business_id", bookingData.business_id)
    .single();

  // Award loyalty points on completion (payment OR no payment required)
  if (loyaltySettings) {
    const settings = loyaltySettings as LoyaltySettings;
    if (settings.enabled && settings.earn_on_completion) {
      // Check if points already awarded to prevent duplicates
      const { data: existingPoints } = await supabase
        .from("loyalty_ledger")
        .select("id")
        .eq("related_booking_id", bookingId)
        .eq("event_type", "completion")
        .single();

      if (!existingPoints) {
        await supabase.from("loyalty_ledger").insert({
          business_id: bookingData.business_id,
          customer_id: bookingData.customer_id,
          event_type: "completion",
          points_delta: settings.points_per_event,
          related_booking_id: bookingId,
        });
      }
    }

    // Handle referral rewards (only if payment succeeded OR no payment system)
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_customer_id", bookingData.customer_id)
      .in("status", ["booked", "paid"])
      .single();

    if (referral) {
      const referralData = referral as Referral;
      await supabase
        .from("referrals")
        .update({ status: "completed_confirmed" })
        .eq("id", referralData.id);

      if (!referralData.reward_issued && settings.enabled) {
        await supabase.from("loyalty_ledger").insert({
          business_id: bookingData.business_id,
          customer_id: referralData.referrer_customer_id,
          event_type: "referral",
          points_delta: settings.points_per_event,
          related_referral_id: referralData.id,
        });

        await supabase
          .from("referrals")
          .update({ reward_issued: true, status: "rewarded" })
          .eq("id", referralData.id);
      }
    }
  }
}

async function cancelBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<void> {
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new Error("Booking not found");

  const bookingData = booking as Booking;

  const { data: policy } = await supabase
    .from("cancellation_policies")
    .select("*")
    .eq("business_id", bookingData.business_id)
    .single();

  if (policy) {
    const policyData = policy as { min_cancel_notice_minutes: number | null };
    if (policyData.min_cancel_notice_minutes) {
      const now = new Date();
      const bookingStart = new Date(bookingData.start_ts);
      const minutesUntilBooking =
        (bookingStart.getTime() - now.getTime()) / 60000;

      if (minutesUntilBooking < policyData.min_cancel_notice_minutes) {
        throw new Error(
          `Cancellations require at least ${policyData.min_cancel_notice_minutes} minutes notice`
        );
      }
    }
  }

  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);
}
