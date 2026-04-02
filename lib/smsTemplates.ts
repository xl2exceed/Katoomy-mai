import { supabaseAdmin } from "@/lib/supabase/admin";

type TemplateKey = "reminder" | "cancel_customer" | "cancel_staff" | "payment_dispute" | "winback" | "referral";

const DEFAULTS: Record<TemplateKey, string> = {
  reminder:        "Hi {{customer_name}}! Reminder: your {{service_name}} appointment is tomorrow at {{appt_time}}. Reply STOP to opt out.",
  cancel_customer: "Hi {{customer_name}}! Your {{appt_time}} appointment has been cancelled. Contact {{business_name}} to reschedule.",
  cancel_staff:    "Hi {{customer_name}}! Your {{service_name}} appointment on {{appt_time}} has been cancelled. Contact {{business_name}} to reschedule.",
  payment_dispute: "Hi {{customer_name}}! {{business_name}} did not receive your payment of ${{amount}}. Please send payment or visit {{pay_link}} to pay online.",
  winback:         "Hey {{customer_name}}! We miss you at {{business_name}}. Come back and book: {{booking_link}}",
  referral:        "Hi {{customer_name}}! Thanks for visiting {{business_name}}. Refer a friend and you both get a discount: {{referral_link}}",
};

/** Fetch one template for a business, falling back to the hardcoded default. */
export async function getSmsTemplate(businessId: string, key: TemplateKey): Promise<string> {
  const { data } = await supabaseAdmin
    .from("sms_templates")
    .select(key)
    .eq("business_id", businessId)
    .maybeSingle();
  return (data as Record<string, string> | null)?.[key] || DEFAULTS[key];
}

/** Replace {{variable}} placeholders in a template string. */
export function fillSmsTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}