-- Fix: record Stripe card payments in alternative_payment_ledger correctly.
-- They should appear in the ledger for tracking, but with platform_fee_cents=0
-- and billing_status='stripe_collected' because Stripe already forwards the $1
-- to Katoomy automatically via application_fee_amount — no monthly billing needed.
--
-- Also adds 'card' to the payment_method check constraint, and adds an INSERT
-- trigger so new bookings created with payment_status already set (e.g. Stripe
-- self-booking flow) are recorded — not just updates.

-- 1. Normalize any existing rows with unexpected payment_method values
UPDATE public.alternative_payment_ledger
  SET payment_method = 'card'
  WHERE payment_method NOT IN ('cashapp', 'cash', 'other', 'card');

-- 2. Expand payment_method constraint to include 'card'
ALTER TABLE public.alternative_payment_ledger
  DROP CONSTRAINT IF EXISTS alternative_payment_ledger_payment_method_check;
ALTER TABLE public.alternative_payment_ledger
  ADD CONSTRAINT alternative_payment_ledger_payment_method_check
  CHECK (payment_method IN ('cashapp', 'cash', 'other', 'card'));

-- 3. Expand billing_status constraint to include 'stripe_collected'
ALTER TABLE public.alternative_payment_ledger
  DROP CONSTRAINT IF EXISTS alternative_payment_ledger_billing_status_check;
ALTER TABLE public.alternative_payment_ledger
  ADD CONSTRAINT alternative_payment_ledger_billing_status_check
  CHECK (billing_status IN ('pending', 'billed', 'waived', 'stripe_collected'));

-- 4. Update the trigger function (handles both INSERT and UPDATE via TG_OP)
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
  v_is_stripe      boolean;
BEGIN
  -- Only act when payment_status is a paid state
  IF NEW.payment_status NOT IN ('paid', 'cash_paid') THEN
    RETURN NEW;
  END IF;
  -- For UPDATE: skip if payment_status didn't actually change
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
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

  -- Determine if this is a direct Stripe card payment:
  -- no booking_payment_reports entry means no "I've Paid" flow was used
  v_is_stripe := (v_payment_method IS NULL AND NEW.payment_status = 'paid');

  IF v_is_stripe THEN
    v_payment_method := 'card';
  ELSE
    v_payment_method := CASE v_payment_method
      WHEN 'cash_app' THEN 'cashapp'
      WHEN 'zelle'    THEN 'other'
      WHEN 'cash'     THEN 'cash'
      ELSE CASE
        WHEN NEW.payment_status = 'cash_paid' THEN 'cashapp'
        ELSE 'cash'
      END
    END;
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
    CASE WHEN v_is_stripe THEN 0 ELSE 100 END,
    v_payment_method,
    CASE WHEN v_is_stripe THEN 'customer' ELSE 'business' END,
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

-- 5. Keep the existing UPDATE trigger
DROP TRIGGER IF EXISTS trg_auto_record_alternative_payment ON public.bookings;
CREATE TRIGGER trg_auto_record_alternative_payment
  AFTER UPDATE OF payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_alternative_payment();

-- 6. Add INSERT trigger so new bookings created already-paid (Stripe self-booking) are recorded
DROP TRIGGER IF EXISTS trg_auto_record_alternative_payment_insert ON public.bookings;
CREATE TRIGGER trg_auto_record_alternative_payment_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_alternative_payment();
