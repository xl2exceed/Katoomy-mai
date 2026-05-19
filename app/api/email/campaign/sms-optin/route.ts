// POST /api/email/campaign/sms-optin
// Sends SMS opt-in invite emails to customers where sms_consent = false and email exists.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM } from "@/lib/email/resend";
import { smsOptinEmailHtml } from "@/lib/email/templates/sms-optin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.katoomy.com";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    // Find customers who haven't opted into SMS but have an email
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", business.id)
      .eq("sms_consent", false)
      .not("email", "is", null);

    const eligible = (customers || []).filter((c) => c.email);

    if (eligible.length === 0) {
      return NextResponse.json({ sent: 0, message: "No eligible customers found" });
    }

    const resend = getResend();
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < eligible.length; i += 10) {
      const batch = eligible.slice(i, i + 10);
      await Promise.all(
        batch.map(async (c) => {
          try {
            const html = smsOptinEmailHtml({
              customerName: c.full_name || "Valued Customer",
              businessName: business.name,
              businessSlug: business.slug,
              appUrl: APP_URL,
            });
            const { error } = await resend.emails.send({
              from: FROM,
              to: c.email!,
              subject: `Stay connected with ${business.name} — enable text updates`,
              html,
            });
            if (error) {
              console.error(`Failed to send to ${c.email}:`, error);
              failed++;
            } else {
              sent++;
            }
          } catch {
            failed++;
          }
        })
      );
    }

    return NextResponse.json({ sent, failed, total: eligible.length });
  } catch (err) {
    console.error("sms-optin campaign error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
