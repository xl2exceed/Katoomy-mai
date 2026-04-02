// GET  /api/admin/sms-templates  — fetch this business's SMS templates
// POST /api/admin/sms-templates  — upsert templates
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS = {
  reminder:        "Hi {{customer_name}}! Reminder: your {{service_name}} appointment is tomorrow at {{appt_time}}. Reply STOP to opt out.",
  cancel_customer: "Hi {{customer_name}}! Your {{appt_time}} appointment has been cancelled. Contact {{business_name}} to reschedule.",
  cancel_staff:    "Hi {{customer_name}}! Your {{service_name}} appointment on {{appt_time}} has been cancelled. Contact {{business_name}} to reschedule.",
  payment_dispute: "Hi {{customer_name}}! {{business_name}} did not receive your payment of ${{amount}}. Please send payment or visit {{pay_link}} to pay online.",
  winback:         "Hey {{customer_name}}! We miss you at {{business_name}}. Come back and book: {{booking_link}}",
  referral:        "Hi {{customer_name}}! Thanks for visiting {{business_name}}. Refer a friend and you both get a discount: {{referral_link}}",
};

async function getBusiness(userId: string) {
  const { data } = await supabaseAdmin
    .from("businesses").select("id").eq("owner_user_id", userId).single();
  return data;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await getBusiness(user.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("sms_templates")
    .select("reminder, cancel_customer, cancel_staff, payment_dispute, winback, referral")
    .eq("business_id", business.id)
    .maybeSingle();

  // Merge DB values over defaults so any missing column falls back gracefully
  return NextResponse.json({ ...DEFAULTS, ...(data ?? {}) });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await getBusiness(user.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const allowed = ["reminder", "cancel_customer", "cancel_staff", "payment_dispute", "winback", "referral"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string") updates[key] = body[key].trim();
  }

  const { error } = await supabaseAdmin
    .from("sms_templates")
    .upsert({ business_id: business.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: "business_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
