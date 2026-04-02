-- SMS message templates per business, configurable from Settings.
-- All columns have defaults matching the current hardcoded messages.
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Transactional
  reminder        text NOT NULL DEFAULT 'Hi {{customer_name}}! Reminder: your {{service_name}} appointment is tomorrow at {{appt_time}}. Reply STOP to opt out.',
  cancel_customer text NOT NULL DEFAULT 'Hi {{customer_name}}! Your {{appt_time}} appointment has been cancelled. Contact {{business_name}} to reschedule.',
  cancel_staff    text NOT NULL DEFAULT 'Hi {{customer_name}}! Your {{service_name}} appointment on {{appt_time}} has been cancelled. Contact {{business_name}} to reschedule.',
  payment_dispute text NOT NULL DEFAULT 'Hi {{customer_name}}! {{business_name}} did not receive your payment of ${{amount}}. Please send payment or visit {{pay_link}} to pay online.',
  -- Marketing (also editable in Growth Hub)
  winback         text NOT NULL DEFAULT 'Hey {{customer_name}}! We miss you at {{business_name}}. Come back and book: {{booking_link}}',
  referral        text NOT NULL DEFAULT 'Hi {{customer_name}}! Thanks for visiting {{business_name}}. Refer a friend and you both get a discount: {{referral_link}}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner manages their SMS templates"
  ON public.sms_templates
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
  );
