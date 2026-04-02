-- Auto-record non-credit-card payments in alternative_payment_ledger
-- via a trigger on bookings.payment_status so no code path can miss it.
--
-- Fires whenever payment_status transitions to 'paid' or 'cash_paid'.
-- Skips if a ledger entry already exists for the booking (idempotent).
-- Wrapped in EXCEPTION so it never blocks the booking update itself.

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

  -- Look up customer details
  SELECT full_name, phone
    INTO v_customer_name, v_customer_phone
    FROM public.customers
   WHERE id = NEW.customer_id;

  -- Look up service name
  SELECT name
    INTO v_service_name
    FROM public.services
   WHERE id = NEW.service_id;

  -- Use payment method from booking_payment_reports if the customer used
  -- the I've Paid flow; otherwise fall back based on payment_status.
  SELECT payment_method
    INTO v_payment_method
    FROM public.booking_payment_reports
   WHERE booking_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_payment_method IS NULL THEN
    v_payment_method := CASE
      WHEN NEW.payment_status = 'cash_paid' THEN 'cash_app'
      ELSE 'cash'
    END;
  END IF;

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
  -- Never block the booking update even if the ledger insert fails
  RAISE WARNING 'auto_record_alternative_payment failed for booking %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_record_alternative_payment ON public.bookings;
CREATE TRIGGER trg_auto_record_alternative_payment
  AFTER UPDATE OF payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_alternative_payment();
