// file: app/api/notifications/process-winbacks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Type for booking data nested in customer query
interface BookingData {
  id: string;
  start_ts: string;
}

// Type for customer with nested bookings
interface CustomerWithBookings {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  bookings: BookingData[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = body;

    if (!business_id) {
      return NextResponse.json(
        { error: "business_id is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 1. Get enabled win-back rules for this business
    const { data: rules, error: rulesError } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("business_id", business_id)
      .eq("kind", "winback")
      .eq("enabled", true);

    if (rulesError) {
      console.error("Error fetching rules:", rulesError);
      return NextResponse.json(
        { error: "Failed to fetch rules" },
        { status: 500 },
      );
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json(
        { message: "No enabled win-back rules found" },
        { status: 200 },
      );
    }

    const scheduledMessages = [];

    // 2. Process each win-back rule
    for (const rule of rules) {
      // Calculate cutoff date (customers who haven't booked in X days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - rule.inactive_days);

      // Find inactive customers (no bookings since cutoff date)
      const { data: inactiveCustomers, error: customersError } = await supabase
        .from("customers")
        .select(
          `
          id,
          full_name,
          phone,
          email,
          bookings!inner(id, start_ts)
        `,
        )
        .eq("business_id", business_id)
        .not("phone", "is", null)
        .order("start_ts", { foreignTable: "bookings", ascending: false });

      if (customersError) {
        console.error("Error fetching customers:", customersError);
        continue;
      }

      if (!inactiveCustomers) continue;

      // Type assertion since Supabase doesn't know about the join
      const typedCustomers =
        inactiveCustomers as unknown as CustomerWithBookings[];

      // Filter customers who haven't booked since cutoff
      const trulyInactive = typedCustomers.filter((customer) => {
        // Get most recent booking
        const mostRecentBooking = customer.bookings?.[0];
        if (!mostRecentBooking) return false;

        const lastBookingDate = new Date(mostRecentBooking.start_ts);
        return lastBookingDate < cutoffDate;
      });

      // 3. Schedule win-back messages for inactive customers
      for (const customer of trulyInactive) {
        // Check if we already sent a win-back message recently
        const recentlySent = await supabase
          .from("scheduled_messages")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("rule_id", rule.id)
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          ) // Last 7 days
          .single();

        if (recentlySent.data) {
          console.log(
            `Skipping customer ${customer.id} - already sent recently`,
          );
          continue;
        }

        // Render template
        const messageBody = renderTemplate(rule.template, {
          customer_name: customer.full_name || "Valued Customer",
        });

        // Schedule to send immediately (or after a small delay)
        const sendTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        const { data: scheduled, error: scheduleError } = await supabase
          .from("scheduled_messages")
          .insert({
            business_id,
            customer_id: customer.id,
            rule_id: rule.id,
            to_number: customer.phone,
            body: messageBody,
            run_at: sendTime.toISOString(),
            status: "scheduled",
          })
          .select()
          .single();

        if (scheduleError) {
          console.error("Error scheduling win-back message:", scheduleError);
          continue;
        }

        scheduledMessages.push(scheduled);
      }
    }

    return NextResponse.json({
      success: true,
      scheduled_count: scheduledMessages.length,
      scheduled_messages: scheduledMessages,
    });
  } catch (error) {
    console.error("Error in process-winbacks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Helper function to render template with variables
function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;

  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, variables[key]);
  });

  return result;
}
