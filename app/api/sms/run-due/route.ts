import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwilio, getFromNumber } from "@/lib/twilio";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // 1. Find all scheduled messages that are due to be sent
    const { data: dueMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "scheduled")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching due messages:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch messages", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!dueMessages || dueMessages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        message: "No messages due to send",
      });
    }

    console.log(`Found ${dueMessages.length} messages to send`);

    const results = {
      processed: dueMessages.length,
      sent: 0,
      failed: 0,
    };

    // Get Twilio config once (outside the loop)
    const mode = (process.env.TWILIO_MODE || "TEST") as "TEST" | "LIVE";
    const { client: twilio } = getTwilio(); // No arguments!
    const fromNumber = getFromNumber(mode); // Pass mode here!

    // 2. Process each message
    for (const msg of dueMessages) {
      try {
        // Mark as processing
        await supabase
          .from("scheduled_messages")
          .update({ status: "processing" })
          .eq("id", msg.id);

        // Send via Twilio
        const twilioMessage = await twilio.messages.create({
          to: msg.to_number,
          from: fromNumber,
          body: msg.body,
        });

        console.log(
          `✅ Sent message ${msg.id} - Twilio SID: ${twilioMessage.sid}`,
        );

        // Log to sms_messages
        const { data: smsRecord, error: smsError } = await supabase
          .from("sms_messages")
          .insert({
            business_id: msg.business_id,
            direction: "outbound",
            to_number: msg.to_number,
            from_number: fromNumber,
            body: msg.body,
            status: twilioMessage.status || "queued",
            provider: "twilio",
            provider_message_id: twilioMessage.sid,
          })
          .select()
          .single();

        if (smsError) {
          console.error("Error logging SMS:", smsError);
        }

        // Update scheduled message to 'sent'
        await supabase
          .from("scheduled_messages")
          .update({
            status: "sent",
            sent_message_id: smsRecord?.id || null,
          })
          .eq("id", msg.id);

        results.sent++;
      } catch (error) {
        console.error(`❌ Failed to send message ${msg.id}:`, error);

        // Mark as failed
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed" })
          .eq("id", msg.id);

        results.failed++;
      }
    }

    console.log("Processing complete:", results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error in run-due:", error);
    return NextResponse.json(
      {
        error: "Failed to process scheduled messages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Allow GET requests too (for browser testing)
export async function GET(req: Request) {
  return POST(req);
}
