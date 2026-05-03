-- Fix: Zelle payments recorded as 'other' with fee_absorbed_by='business' due to:
-- 1. payment_method check constraint not including 'zelle'
--    → app-code UPDATE with payment_method='zelle' failed silently, leaving trigger's value
-- 2. Trigger (20260415 version) hardcoded fee_absorbed_by='business' for non-Stripe payments
--    instead of reading from cashapp_settings.fee_mode
--
-- This migration:
-- (a) Adds 'zelle' to the payment_method constraint
-- (b) Repairs existing 'other' rows that were actually Zelle payments
-- (c) Replaces the trigger function to preserve 'zelle' and read fee_absorbed_by correctly

-- 1. Expand payment_method constraint to include 'zelle'
ALTER TABLE public.alternative_payment_ledger
  DROP CONSTRAINT IF EXISTS alternative_payment_ledger_payment_method_check;
ALTER TABLE public.alternative_payment_ledger
  ADD CONSTRAINT alternative_payment_ledger_payment_method_check
  CHECK (payment_method IN ('cashapp', 'cash', 'other', 'card', 'zelle'));

-- 2. Repair existing rows: flip 'other' → 'zelle' where the booking_payment_report
--    shows the customer chose Zelle, and fix fee_absorbed_by from cashapp_settings.
UPDATE public.alternative_payment_ledger apl
SET
  payment_method   = 'zelle',
  fee_absorbed_by  = COALESCE(
    (SELECT CASE WHEN cs.fee_mode = 'business_absorbs' THEN 'business' ELSE 'customer' END
       FROM public.cashapp_settings cs WHERE cs.business_id = apl.business_id),
    'customer'
  )
WHERE apl.payment_method = 'other'
  AND apl.booking_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.booking_payment_reports bpr
    WHERE bpr.booking_id = apl.booking_id
      AND bpr.payment_method = 'zelle'
  );

-- 3. Replace trigger function: preserve 'zelle', read fee_absorbed_by from cashapp_settings
CREATE OR REPLACE FUNCTION public.auto_record_alternative_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_name      text;
  v_customer_phone     text;
  v_service_name       text;
  v_payment_method     text;
  v_billing_month      text;
  v_is_stripe          boolean;
  v_fee_mode           text;
  v_fee_absorbed_by    text;
  v_platform_fee_cents integer;
BEGIN
  IF NEW.payment_status NOT IN ('paid', 'cash_paid') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.alternative_payment_ledger WHERE booking_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT payment_method
    INTO v_payment_method
    FROM public.booking_payment_reports
   WHERE booking_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  v_is_stripe := (v_payment_method IS NULL AND NEW.payment_status = 'paid');

  IF v_is_stripe THEN
    v_payment_method := 'card';
  ELSE
    v_payment_method := CASE v_payment_method
      WHEN 'cash_app' THEN 'cashapp'
      WHEN 'zelle'    THEN 'zelle'
      WHEN 'cash'     THEN 'cash'
      ELSE CASE
        WHEN NEW.payment_status = 'cash_paid' THEN 'cashapp'
        ELSE 'cash'
      END
    END;
  END IF;

  SELECT fee_mode
    INTO v_fee_mode
    FROM public.cashapp_settings
   WHERE business_id = NEW.business_id;

  IF v_is_stripe THEN
    v_fee_absorbed_by    := 'customer';
    v_platform_fee_cents := 0;
  ELSIF v_fee_mode = 'business_absorbs' THEN
    v_fee_absorbed_by    := 'business';
    v_platform_fee_cents := 0;
  ELSE
    v_fee_absorbed_by    := 'customer';
    v_platform_fee_cents := 100;
  END IF;

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
    business_id, booking_id, customer_name, customer_phone, service_name,
    service_amount_cents, tip_cents, platform_fee_cents, payment_method,
    fee_absorbed_by, billing_month, billing_status, notes
  ) VALUES (
    NEW.business_id, NEW.id, v_customer_name, v_customer_phone, v_service_name,
    NEW.total_price_cents, 0,
    v_platform_fee_cents,
    v_payment_method,
    v_fee_absorbed_by,
    v_billing_month,
    CASE WHEN v_is_stripe THEN 'stripe_collected' ELSE 'pending' END,
    CASE WHEN v_is_stripe THEN 'Stripe card payment — fee collected automatically'
         ELSE 'Auto-recorded by payment trigger' END
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_record_alternative_payment failed for booking %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Re-create both triggers with the updated function
DROP TRIGGER IF EXISTS trg_auto_record_alternative_payment ON public.bookings;
CREATE TRIGGER trg_auto_record_alternative_payment
  AFTER UPDATE OF payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_alternative_payment();

DROP TRIGGER IF EXISTS trg_auto_record_alternative_payment_insert ON public.bookings;
CREATE TRIGGER trg_auto_record_alternative_payment_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_alternative_payment();
