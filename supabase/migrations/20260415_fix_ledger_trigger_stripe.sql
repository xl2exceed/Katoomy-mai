-- Fix: prevent Stripe card payments from being recorded as "cash" in alternative_payment_ledger.
-- When payment_status = 'paid' and there is no booking_payment_reports entry, this is a direct
-- Stripe charge (not cash/Cash App/Zelle) — skip the ledger insert entirely.

CREATE OR REPLACE FUNCTION public.auto_record_alternative_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_name  text;
  v_customer_phone text;
  v_service_name   text;
  v_payment_method text;
  v_billing_month  text;
BEGIN
  -- Only act when payment_status transitions to a paid state
  IF NEW.payment_status NOT IN ('paid', 'cash_paid') THEN
    RETURN NEW;
  END IF;
  -- Skip if payment_status didn't actually change
  IF OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;
  -- Skip if already recorded (idempotent)
  IF EXISTS (
    SELECT 1 FROM public.alternative_payment_ledger WHERE booking_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Look up payment method from booking_payment_reports (set by cash/Cash App/Zelle I've Paid flow)
  SELECT payment_method
    INTO v_payment_method
    FROM public.booking_payment_reports
   WHERE booking_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  -- If no payment report entry exists and status is 'paid', this is a direct Stripe card payment.
  -- Stripe payments are recorded in the `payments` table, not here — skip.
  IF v_payment_method IS NULL AND NEW.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Normalize to values allowed by the check constraint
  v_payment_method := CASE v_payment_method
    WHEN 'cash_app' THEN 'cashapp'
    WHEN 'zelle'    THEN 'other'
    WHEN 'cash'     THEN 'cash'
    ELSE CASE
      WHEN NEW.payment_status = 'cash_paid' THEN 'cashapp'
      ELSE 'cash'
    END
  END;

  -- Look up customer and service details
  SELECT full_name, phone
    INTO v_customer_name, v_customer_phone
    FROM public.customers
   WHERE id = NEW.customer_id;

  SELECT name
    INTO v_service_name
    FROM public.services
   WHERE id = NEW.service_id;

  v_billing_month := to_char(now(), 'YYYY-MM');

  INSERT INTO public.alternative_payment_ledger (
    business_id,
    booking_id,
    customer_name,
    customer_phone,
    service_name,
    service_amount_cents,
    tip_cents,
    platform_fee_cents,
    payment_method,
    fee_absorbed_by,
    billing_month,
    billing_status,
    notes
  ) VALUES (
    NEW.business_id,
    NEW.id,
    v_customer_name,
    v_customer_phone,
    v_service_name,
    NEW.total_price_cents,
    0,
    100,
    v_payment_method,
    'business',
    v_billing_month,
    'pending',
    'Auto-recorded by payment trigger'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_record_alternative_payment failed for booking %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
