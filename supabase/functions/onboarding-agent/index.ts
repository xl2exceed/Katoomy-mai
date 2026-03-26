// file: supabase/functions/onboarding-agent/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

interface Action {
  action: string;
  description: string;
  parameters: Record<string, string>;
}

interface ToolCall {
  action: string;
  input: Record<string, unknown>;
}

interface MessageContent {
  type: string;
  text?: string;
  input?: Record<string, unknown>;
  id?: string;
  tool_use_id?: string;
  content?: string;
  name?: string;
}

interface ClaudeMessage {
  role: string;
  content: string | MessageContent[];
}

interface ClaudeResponse {
  content: MessageContent[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Parse request body with error handling
    let business_id: string;
    let message: string;
    let conversation_history: ClaudeMessage[];

    try {
      const text = await req.text();
      console.log("Received request body:", text);

      if (!text || text.trim() === "") {
        throw new Error("Empty request body");
      }

      const body = JSON.parse(text);
      business_id = body.business_id as string;
      message = body.message as string;
      conversation_history = (body.conversation_history ||
        []) as ClaudeMessage[];
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details:
            parseError instanceof Error ? parseError.message : "Unknown error",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("Parsed request:", {
      business_id,
      message,
      has_history: conversation_history.length > 0,
    });

    if (!business_id || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: business_id or message",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Allowed actions schema
    const allowedActions: Action[] = [
      {
        action: "SET_OWNER_INFO",
        description:
          "Set business owner contact information (name, phone, email)",
        parameters: {
          name: "string (required) - Owner's full name (also accepts 'owner_name')",
          phone:
            "string (required) - Owner's phone number (also accepts 'owner_phone')",
          email:
            "string (required) - Owner's email address (also accepts 'owner_email')",
        },
      },
      {
        action: "SET_BRANDING",
        description:
          "Set business name and app name (use same value for both), logo URL, and primary color",
        parameters: {
          business_name: "string (optional) - The business name",
          app_name:
            "string (optional) - The app name (usually same as business_name)",
          logo_url: "string (optional)",
          primary_color: "string (optional) - hex color",
        },
      },
      {
        action: "SET_AVAILABILITY_RULES",
        description:
          "Set which days business is open, hours, and buffer time between appointments",
        parameters: {
          days_open: "array of strings (optional) - e.g. ['monday', 'tuesday']",
          open_time: "string (optional) - e.g. '09:00'",
          close_time: "string (optional) - e.g. '17:00'",
          buffer_minutes: "number (optional)",
        },
      },
      {
        action: "UPSERT_SERVICE",
        description:
          "Create or update a service with name, price, and duration",
        parameters: {
          service_id: "string (optional) - if updating existing",
          name: "string (required)",
          price_cents: "number (required)",
          duration_minutes: "number (required)",
          active: "boolean (optional, default true)",
        },
      },
      {
        action: "ARCHIVE_SERVICE",
        description: "Archive/deactivate a service",
        parameters: {
          service_id: "string (required)",
        },
      },
      {
        action: "START_STRIPE_CONNECT",
        description:
          "Tell user to connect Stripe for payments (we handle the setup)",
        parameters: {},
      },
      {
        action: "SET_DEPOSIT_RULES",
        description: "Configure deposit requirements",
        parameters: {
          enabled: "boolean (required)",
          type: "string (optional) - 'flat' or 'percent'",
          amount_cents: "number (optional) - if flat",
          percent: "number (optional) - if percent",
        },
      },
      {
        action: "SET_LOYALTY_RULES",
        description: "Configure loyalty program",
        parameters: {
          enabled: "boolean (required)",
          earn_on_booking: "boolean (optional)",
          earn_on_completion: "boolean (optional)",
          earn_on_referral: "boolean (optional)",
          points_per_event: "number (optional)",
          threshold_points: "number (optional)",
          reward_type:
            "string (optional) - 'discount', 'free_service', or 'custom_prize'",
          reward_value: "string (optional)",
        },
      },
      {
        action: "SET_REFERRAL_RULES",
        description: "Configure referral rewards",
        parameters: {
          enabled: "boolean (required)",
          reward_type: "string (optional) - 'discount' or 'free_service'",
          reward_value: "string (optional)",
        },
      },
      {
        action: "TOGGLE_FEATURE",
        description: "Enable/disable features",
        parameters: {
          feature_name:
            "string (required) - e.g. 'web_search_enabled', 'loyalty_enabled'",
          enabled: "boolean (required)",
        },
      },
      {
        action: "SET_NOTIFICATION_PREFS",
        description: "Configure notification settings",
        parameters: {
          booking_confirmations: "boolean (optional)",
          appointment_reminders: "boolean (optional)",
          cancellation_notices: "boolean (optional)",
          promotions: "boolean (optional)",
          loyalty_updates: "boolean (optional)",
          channels: "array of strings (optional) - e.g. ['email', 'sms']",
        },
      },
      {
        action: "MARK_STEP_COMPLETE",
        description:
          "Mark current onboarding step as complete and move to next",
        parameters: {
          step_name: "string (required) - the step that was just completed",
        },
      },
    ];

    const systemPrompt = `You are a friendly AI assistant helping business owners set up their booking app.

CRITICAL RULES:
1. IMMEDIATELY call the appropriate tool as soon as you have the required information
2. After calling a tool, ask the NEXT question - never repeat that you're saving
3. Keep responses VERY short (1-2 sentences max)
4. Never say you "will save" or "let me save" - just DO it by calling the tool

EXACT SETUP FLOW (in this order):
1. BUSINESS NAME: Ask for business name → IMMEDIATELY call SET_BRANDING with BOTH business_name AND app_name (set both to the same value)
2. OWNER NAME: Ask for full name → Save it (you'll use it in step 3)
3. OWNER PHONE: Ask for phone → IMMEDIATELY call SET_OWNER_INFO with all 3 fields (name, phone, email from next step)
4. OWNER EMAIL: Ask "What's your email address?" → NOW call SET_OWNER_INFO with all three: name, phone, AND email (don't forget email!)
5. LOGO: Ask if they want a logo. If no, move on. If yes, tell them to upload in Settings later, then move on.
6. COLOR: Ask for brand color → call SET_BRANDING with primary_color
7. DAYS: Ask "Which days are you open?" → Parse their answer into an array:
   - "Monday-Friday" or "Monday through Friday" = ["monday","tuesday","wednesday","thursday","friday"]
   - "Weekdays" = ["monday","tuesday","wednesday","thursday","friday"]  
   - "Monday, Wednesday, Friday" = ["monday","wednesday","friday"]
   - "Every day" or "7 days" = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
   Store as array, DON'T call SET_AVAILABILITY_RULES yet
8. HOURS: Ask "What time do you open?" and "What time do you close?" → NOW call SET_AVAILABILITY_RULES with days_open, start_time, and end_time (all three at once)
9. BUFFER: Ask for buffer time → call SET_AVAILABILITY_RULES with buffer_minutes
10. SERVICE: Ask "What's your first service? Tell me the name, price, and how long it takes. Example: Haircut, $30, 45 minutes OR Massage, $80, 1 hour" → Parse their answer flexibly:
   - Extract the name
   - Convert price to cents (remove $, multiply by 100)
   - Convert duration to minutes:
     * "2 hours" = 120 minutes
     * "1 hour 30 minutes" = 90 minutes  
     * "45 minutes" = 45 minutes
     * "1.5 hours" = 90 minutes
   → call UPSERT_SERVICE
11. MORE SERVICES: Ask if they want to add another. If yes, repeat step 10. If no, continue.
12. DONE: Say "Setup complete! 🎉" and call MARK_STEP_COMPLETE with step_name="done"

ACTION RULES:
- Call tools IMMEDIATELY when you have data
- NEVER say "let me save" without calling the tool
- After calling a tool, move to the NEXT question
- Don't wait for confirmation to call tools
- If a tool call succeeds, immediately ask the next question
- For PRICES: always convert dollars to cents (multiply by 100) before calling UPSERT_SERVICE
- For DURATION: be flexible - accept "2 hours", "1 hour 30 minutes", "90 minutes", "1.5 hours" etc. Always convert to total minutes.
- Be flexible with user input - extract the info you need even if they don't format it perfectly
- For AVAILABILITY: Collect days first, then hours, then call SET_AVAILABILITY_RULES with ALL data at once (days_open, start_time, end_time)

Example good flow:
User: "Bob's Cleaning"
You: *calls SET_BRANDING* "Great! What's your full name?"

Example service extraction:
User: "Grass cutting, $100, 2 hours"
You: *calls UPSERT_SERVICE with name="Grass cutting", price_cents=10000, duration_minutes=120* "Got it! Want to add another service?"`;

    // Call Claude API
    const messages = [...conversation_history];
    messages.push({
      role: "user",
      content: message,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
        tools: [
          {
            name: "execute_action",
            description: "Execute one of the allowed onboarding actions",
            input_schema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: allowedActions.map((a) => a.action),
                  description: "The action to execute",
                },
                parameters: {
                  type: "object",
                  description: "Parameters for the action",
                },
              },
              required: ["action", "parameters"],
            },
          },
        ],
      }),
    });

    const data = (await response.json()) as ClaudeResponse;

    // Add this logging
    console.log("Claude API response:", JSON.stringify(data, null, 2));
    console.log(
      "Content blocks:",
      data.content.map((b) => ({ type: b.type, hasInput: !!b.input }))
    );

    // Handle tool use
    const toolUseBlock = data.content.find(
      (block) => block.type === "tool_use"
    );

    if (toolUseBlock && toolUseBlock.input) {
      console.log("Tool use detected:", toolUseBlock);

      const toolCall: ToolCall = {
        action: (toolUseBlock.input as Record<string, unknown>)
          .action as string,
        input: (toolUseBlock.input as Record<string, unknown>)
          .parameters as Record<string, unknown>,
      };

      let result: { success: boolean; message: string };

      switch (toolCall.action) {
        case "SET_OWNER_INFO": {
          console.log("=== SET_OWNER_INFO START ===");
          console.log("Tool input:", JSON.stringify(toolCall.input));

          // Accept both "name" and "owner_name" formats
          const owner_name = (toolCall.input.owner_name ||
            toolCall.input.name) as string;
          const owner_phone = (toolCall.input.owner_phone ||
            toolCall.input.phone) as string;
          const owner_email = (toolCall.input.owner_email ||
            toolCall.input.email) as string | undefined;

          console.log("Extracted values:", {
            owner_name,
            owner_phone,
            owner_email,
          });

          const updates: Record<string, string> = {};
          if (owner_name) updates.owner_name = owner_name;
          if (owner_phone) updates.owner_phone = owner_phone;
          if (owner_email) updates.owner_email = owner_email;

          console.log("Updates object:", JSON.stringify(updates));

          const { data: updateData, error } = await supabaseClient
            .from("businesses")
            .update(updates)
            .eq("id", business_id)
            .select();

          console.log("Supabase response - data:", JSON.stringify(updateData));
          console.log("Supabase response - error:", error);
          console.log("=== SET_OWNER_INFO END ===");

          if (error) {
            console.error("Database error:", error);
            throw error;
          }

          result = {
            success: true,
            message: "Owner information saved",
          };
          break;
        }

        case "SET_BRANDING": {
          console.log("=== SET_BRANDING START ===");
          console.log("Tool input:", JSON.stringify(toolCall.input));
          console.log("Business ID:", business_id);

          const business_name = toolCall.input.business_name as
            | string
            | undefined;
          const app_name = toolCall.input.app_name as string | undefined;
          const logo_url = toolCall.input.logo_url as string | undefined;
          const primary_color = toolCall.input.primary_color as
            | string
            | undefined;

          const updates: Record<string, string> = {};
          if (business_name) updates.name = business_name;
          if (app_name) updates.app_name = app_name;
          if (logo_url) updates.logo_url = logo_url;
          if (primary_color) updates.primary_color = primary_color;

          console.log("Updates object:", JSON.stringify(updates));
          console.log("About to call Supabase update...");

          const { data: updateData, error } = await supabaseClient
            .from("businesses")
            .update(updates)
            .eq("id", business_id)
            .select();

          console.log("Supabase response - data:", updateData);
          console.log("Supabase response - error:", error);
          console.log("=== SET_BRANDING END ===");

          if (error) throw error;

          result = {
            success: true,
            message: "Branding updated",
          };
          break;
        }

        case "SET_AVAILABILITY_RULES": {
          console.log("=== SET_AVAILABILITY_RULES START ===");
          console.log("Tool input:", JSON.stringify(toolCall.input));
          console.log("Business ID:", business_id);

          let days_open = toolCall.input.days_open as
            | string[]
            | string
            | undefined;
          const open_time = (toolCall.input.open_time ||
            toolCall.input.start_time) as string | undefined;
          const close_time = (toolCall.input.close_time ||
            toolCall.input.end_time) as string | undefined;
          const buffer_minutes = toolCall.input.buffer_minutes as
            | number
            | undefined;

          if (typeof days_open === "string") {
            days_open = days_open.split(",").map((d) => d.trim().toLowerCase());
          }

          console.log("Parsed values:", {
            days_open,
            open_time,
            close_time,
            buffer_minutes,
          });

          const { data: existing } = await supabaseClient
            .from("availability_rules")
            .select("id")
            .eq("business_id", business_id)
            .single();

          console.log("Existing rule:", existing);

          const ruleData: Record<string, string | number | string[]> = {
            business_id,
          };
          if (days_open && Array.isArray(days_open))
            ruleData.days_open = days_open;
          if (open_time) ruleData.start_time = open_time;
          if (close_time) ruleData.end_time = close_time;
          if (buffer_minutes !== undefined)
            ruleData.buffer_minutes = buffer_minutes;

          console.log("Rule data to save:", JSON.stringify(ruleData));

          let saveError = null;
          if (existing) {
            const { error } = await supabaseClient
              .from("availability_rules")
              .update(ruleData)
              .eq("id", existing.id);
            saveError = error;
          } else {
            const { error } = await supabaseClient
              .from("availability_rules")
              .insert(ruleData);
            saveError = error;
          }

          console.log("Save error:", saveError);
          console.log("=== SET_AVAILABILITY_RULES END ===");

          if (saveError) throw saveError;

          result = {
            success: true,
            message: "Availability rules set",
          };
          break;
        }

        case "UPSERT_SERVICE": {
          const service_id = toolCall.input.service_id as string | undefined;
          const name = toolCall.input.name as string;
          const price_cents = toolCall.input.price_cents as number;
          const duration_minutes = toolCall.input.duration_minutes as number;
          const active = toolCall.input.active as boolean | undefined;

          if (service_id) {
            await supabaseClient
              .from("services")
              .update({
                name,
                price_cents,
                duration_minutes,
                active: active !== undefined ? active : true,
              })
              .eq("id", service_id);
          } else {
            await supabaseClient.from("services").insert({
              business_id,
              name,
              price_cents,
              duration_minutes,
              active: active !== undefined ? active : true,
            });
          }

          result = {
            success: true,
            message: `Service '${name}' saved`,
          };
          break;
        }

        case "ARCHIVE_SERVICE": {
          const service_id = toolCall.input.service_id as string;

          await supabaseClient
            .from("services")
            .update({ active: false })
            .eq("id", service_id);

          result = {
            success: true,
            message: "Service archived",
          };
          break;
        }

        case "START_STRIPE_CONNECT": {
          result = {
            success: true,
            message:
              "Stripe Connect can be set up later in Settings → Payments",
          };
          break;
        }

        case "SET_DEPOSIT_RULES": {
          const enabled = toolCall.input.enabled as boolean;
          const type = toolCall.input.type as string | undefined;
          const amount_cents = toolCall.input.amount_cents as
            | number
            | undefined;
          const percent = toolCall.input.percent as number | undefined;

          const { data: existing } = await supabaseClient
            .from("deposit_settings")
            .select("business_id")
            .eq("business_id", business_id)
            .single();

          const depositData: Record<string, string | number | boolean> = {
            business_id,
            enabled,
          };
          if (type) depositData.type = type;
          if (amount_cents !== undefined)
            depositData.amount_cents = amount_cents;
          if (percent !== undefined) depositData.percent = percent;

          if (existing) {
            await supabaseClient
              .from("deposit_settings")
              .update(depositData)
              .eq("business_id", business_id);
          } else {
            await supabaseClient.from("deposit_settings").insert(depositData);
          }

          result = {
            success: true,
            message: "Deposit settings saved",
          };
          break;
        }

        case "SET_LOYALTY_RULES": {
          const enabled = toolCall.input.enabled as boolean;
          const earn_on_booking = toolCall.input.earn_on_booking as
            | boolean
            | undefined;
          const earn_on_completion = toolCall.input.earn_on_completion as
            | boolean
            | undefined;
          const earn_on_referral = toolCall.input.earn_on_referral as
            | boolean
            | undefined;
          const points_per_event = toolCall.input.points_per_event as
            | number
            | undefined;
          const threshold_points = toolCall.input.threshold_points as
            | number
            | undefined;
          const reward_type = toolCall.input.reward_type as string | undefined;
          const reward_value = toolCall.input.reward_value as
            | string
            | undefined;

          const { data: existing } = await supabaseClient
            .from("loyalty_settings")
            .select("business_id")
            .eq("business_id", business_id)
            .single();

          const loyaltyData: Record<string, string | number | boolean> = {
            business_id,
            enabled,
          };
          if (earn_on_booking !== undefined)
            loyaltyData.earn_on_booking = earn_on_booking;
          if (earn_on_completion !== undefined)
            loyaltyData.earn_on_completion = earn_on_completion;
          if (earn_on_referral !== undefined)
            loyaltyData.earn_on_referral = earn_on_referral;
          if (points_per_event !== undefined)
            loyaltyData.points_per_event = points_per_event;
          if (threshold_points !== undefined)
            loyaltyData.threshold_points = threshold_points;
          if (reward_type) loyaltyData.reward_type = reward_type;
          if (reward_value) loyaltyData.reward_value = reward_value;

          if (existing) {
            await supabaseClient
              .from("loyalty_settings")
              .update(loyaltyData)
              .eq("business_id", business_id);
          } else {
            await supabaseClient.from("loyalty_settings").insert(loyaltyData);
          }

          await supabaseClient
            .from("business_features")
            .update({ loyalty_enabled: enabled })
            .eq("business_id", business_id);

          result = {
            success: true,
            message: "Loyalty program configured",
          };
          break;
        }

        case "SET_REFERRAL_RULES": {
          const enabled = toolCall.input.enabled as boolean;

          await supabaseClient
            .from("business_features")
            .update({
              referral_enabled: enabled,
            })
            .eq("business_id", business_id);

          result = {
            success: true,
            message: "Referral program configured",
          };
          break;
        }

        case "TOGGLE_FEATURE": {
          const feature_name = toolCall.input.feature_name as string;
          const enabled = toolCall.input.enabled as boolean;

          await supabaseClient
            .from("business_features")
            .update({ [feature_name]: enabled })
            .eq("business_id", business_id);

          result = {
            success: true,
            message: `Feature ${feature_name} ${
              enabled ? "enabled" : "disabled"
            }`,
          };
          break;
        }

        case "SET_NOTIFICATION_PREFS": {
          const booking_confirmations = toolCall.input.booking_confirmations as
            | boolean
            | undefined;
          const appointment_reminders = toolCall.input.appointment_reminders as
            | boolean
            | undefined;
          const cancellation_notices = toolCall.input.cancellation_notices as
            | boolean
            | undefined;
          const promotions = toolCall.input.promotions as boolean | undefined;
          const loyalty_updates = toolCall.input.loyalty_updates as
            | boolean
            | undefined;
          const channels = toolCall.input.channels as string[] | undefined;

          const { data: existing } = await supabaseClient
            .from("notification_settings")
            .select("business_id")
            .eq("business_id", business_id)
            .single();

          const notifData: Record<string, string | boolean | string[]> = {
            business_id,
          };
          if (booking_confirmations !== undefined)
            notifData.booking_confirmations = booking_confirmations;
          if (appointment_reminders !== undefined)
            notifData.appointment_reminders = appointment_reminders;
          if (cancellation_notices !== undefined)
            notifData.cancellation_notices = cancellation_notices;
          if (promotions !== undefined) notifData.promotions = promotions;
          if (loyalty_updates !== undefined)
            notifData.loyalty_updates = loyalty_updates;
          if (channels) notifData.channels = channels;

          if (existing) {
            await supabaseClient
              .from("notification_settings")
              .update(notifData)
              .eq("business_id", business_id);
          } else {
            await supabaseClient
              .from("notification_settings")
              .insert(notifData);
          }

          result = {
            success: true,
            message: "Notification preferences saved",
          };
          break;
        }

        case "MARK_STEP_COMPLETE": {
          const step_name = toolCall.input.step_name as string;

          await supabaseClient
            .from("onboarding_state")
            .update({
              current_step: step_name,
            })
            .eq("business_id", business_id);

          if (step_name === "done" || step_name === "completed") {
            await supabaseClient
              .from("onboarding_state")
              .update({
                status: "completed",
              })
              .eq("business_id", business_id);
          }

          result = {
            success: true,
            message: `Step '${step_name}' completed`,
          };
          break;
        }

        default:
          result = {
            success: false,
            message: "Unknown action",
          };
      }

      // Tool executed successfully
      console.log("Tool executed successfully:", result);

      // Build conversation with tool result
      const messagesWithToolResult = [...messages];

      // Add assistant's response with tool use
      messagesWithToolResult.push({
        role: "assistant",
        content: data.content, // <-- Don't stringify, keep it as array
      });

      // Add tool result
      messagesWithToolResult.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: (toolUseBlock as { id: string }).id,
            content: JSON.stringify(result),
          },
        ],
      });

      // Make follow-up API call to get text response
      const followUpResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: messagesWithToolResult,
            tools: [
              {
                name: "execute_action",
                description: "Execute one of the allowed onboarding actions",
                input_schema: {
                  type: "object",
                  properties: {
                    action: {
                      type: "string",
                      enum: allowedActions.map((a) => a.action),
                      description: "The action to execute",
                    },
                    parameters: {
                      type: "object",
                      description: "Parameters for the action",
                    },
                  },
                  required: ["action", "parameters"],
                },
              },
            ],
          }),
        }
      );

      const followUpData = (await followUpResponse.json()) as ClaudeResponse;
      console.log("Follow-up response:", JSON.stringify(followUpData, null, 2));

      // Extract text from response, even if there's another tool_use
      const textBlock = followUpData.content.find(
        (block) => block.type === "text"
      );

      // Check if setup is complete
      const isComplete = messagesWithToolResult.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("MARK_STEP_COMPLETE")
      );

      let responseText = "Let's continue!";
      if (textBlock && textBlock.text) {
        responseText = textBlock.text;
      } else if (isComplete) {
        responseText = "Setup complete! 🎉 You can now go to your dashboard.";
      }

      return new Response(
        JSON.stringify({
          response: responseText,
          conversation_history: messagesWithToolResult,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } // <-- This closes the "if (toolUseBlock && toolUseBlock.input)" block

    // No tool use, just return response
    return new Response(
      JSON.stringify({
        response:
          data.content[0]?.text || "I'm here to help you set up your business!",
        conversation_history: messages,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
