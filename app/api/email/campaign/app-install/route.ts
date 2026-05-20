// POST /api/email/campaign/app-install
// Sends app-install invite emails to customers where app_installed = false and email exists.
// Supports bulk (send to all eligible) and will be called by automation hooks too.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getResend, FROM } from "@/lib/email/resend";
import { appInstallEmailHtml } from "@/lib/email/templates/app-install";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.katoomy.com";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await req.json().catch(() => {});

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    // Find customers without app installed who have an email
    const { data: devices } = await supabaseAdmin
      .from("customer_devices")
      .select("customer_id")
      .eq("business_id", business.id)
      .eq("app_installed", true);

    const installedCustomerIds = new Set((devices || []).map((d) => d.customer_id));

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, email")
      .eq("business_id", business.id)
      .not("email", "is", null);

    const eligible = (customers || []).filter(
      (c) => c.email && !installedCustomerIds.has(c.id)
    );

    if (eligible.length === 0) {
      return NextResponse.json({ sent: 0, message: "No eligible customers found" });
    }

    const resend = getResend();
    let sent = 0;
    let failed = 0;

    // Send in batches of 10 to avoid rate limits
    for (let i = 0; i < eligible.length; i += 10) {
      const batch = eligible.slice(i, i + 10);
      await Promise.all(
        batch.map(async (c) => {
          try {
            const html = appInstallEmailHtml({
              customerName: c.full_name || "Valued Customer",
              businessName: business.name,
              businessSlug: business.slug,
              appUrl: APP_URL,
              emailNumber: 1,
            });
            const subject = `Get the ${business.name} app — book faster, earn rewards`;
            const { error } = await resend.emails.send({
              from: FROM,
              to: c.email!,
              subject,
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
    console.error("app-install campaign error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
