import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTwilio, getFromNumber } from "@/lib/twilio";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin;

  try {
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

    const mode = (process.env.TWILIO_MODE || "TEST") as "TEST" | "LIVE";
    const { client: twilio } = getTwilio();
    const fromNumber = getFromNumber(mode);

    // Process all messages in parallel
    const outcomes = await Promise.all(
      dueMessages.map(async (msg) => {
        try {
          await supabase
            .from("scheduled_messages")
            .update({ status: "processing" })
            .eq("id", msg.id);

          const twilioMessage = await twilio.messages.create({
            to: msg.to_number,
            from: fromNumber,
            body: msg.body,
          });

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

          await supabase
            .from("scheduled_messages")
            .update({ status: "sent", sent_message_id: smsRecord?.id || null })
            .eq("id", msg.id);

          return "sent";
        } catch (error) {
          console.error(`❌ Failed to send message ${msg.id}:`, error);
          await supabase
            .from("scheduled_messages")
            .update({ status: "failed" })
            .eq("id", msg.id);
          return "failed";
        }
      }),
    );

    const sent = outcomes.filter((r) => r === "sent").length;
    const failed = outcomes.filter((r) => r === "failed").length;

    console.log("Processing complete:", { processed: dueMessages.length, sent, failed });

    return NextResponse.json({ success: true, processed: dueMessages.length, sent, failed });
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
