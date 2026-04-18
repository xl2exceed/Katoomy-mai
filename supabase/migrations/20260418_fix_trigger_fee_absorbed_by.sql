-- Fix: auto_record_alternative_payment trigger was hardcoding fee_absorbed_by='business'
-- for all non-Stripe payments, ignoring the cashapp_settings.fee_mode setting.
-- Now reads fee_mode per-business and writes the correct value.

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

  -- Look up payment method from booking_payment_reports (set by I've Paid / Cash App flows)
  SELECT payment_method
    INTO v_payment_method
    FROM public.booking_payment_reports
   WHERE booking_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  -- Stripe: no booking_payment_reports row and payment_status = 'paid'
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

  -- Look up this business's fee mode (default: pass_to_customer when no row exists)
  SELECT fee_mode
    INTO v_fee_mode
    FROM public.cashapp_settings
   WHERE business_id = NEW.business_id;

  -- Compute fee fields
  IF v_is_stripe THEN
    -- Stripe: $1 application fee already collected by Stripe — no monthly billing needed
    v_fee_absorbed_by    := 'customer';
    v_platform_fee_cents := 0;
  ELSIF v_fee_mode = 'business_absorbs' THEN
    v_fee_absorbed_by    := 'business';
    v_platform_fee_cents := 0;
  ELSE
    -- pass_to_customer (default when no cashapp_settings row)
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

-- Re-create both triggers (UPDATE and INSERT) using the updated function
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

-- Remove duplicate ledger entries (keep the most recently created row per booking_id).
-- Duplicates were caused by the trigger firing AND explicit route inserts both running.
DELETE FROM public.alternative_payment_ledger
WHERE booking_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (booking_id) id
    FROM public.alternative_payment_ledger
    WHERE booking_id IS NOT NULL
    ORDER BY booking_id, created_at DESC
  );

-- Add a partial unique index so one booking can only ever produce one ledger row.
-- Partial (WHERE booking_id IS NOT NULL) preserves manual/unlinked entries.
DROP INDEX IF EXISTS public.alt_ledger_booking_id_unique;
CREATE UNIQUE INDEX alt_ledger_booking_id_unique
  ON public.alternative_payment_ledger (booking_id)
  WHERE booking_id IS NOT NULL;
