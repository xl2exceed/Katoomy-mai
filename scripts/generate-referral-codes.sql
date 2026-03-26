-- Generate referral codes for existing customers without one
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  customer_record RECORD;
  base_code TEXT;
  new_code TEXT;
  random_num INTEGER;
  code_exists BOOLEAN;
BEGIN
  -- Loop through all customers without referral codes
  FOR customer_record IN 
    SELECT id, full_name, phone, business_id 
    FROM customers 
    WHERE referral_code IS NULL
  LOOP
    -- Generate base from name or phone
    IF customer_record.full_name IS NOT NULL AND customer_record.full_name != '' THEN
      base_code := UPPER(SUBSTRING(
        REGEXP_REPLACE(SPLIT_PART(customer_record.full_name, ' ', 1), '[^a-zA-Z]', '', 'g'),
        1, 6
      ));
    ELSE
      base_code := 'CUST' || SUBSTRING(customer_record.phone, LENGTH(customer_record.phone) - 3);
    END IF;
    
    -- Try to find unique code
    code_exists := TRUE;
    WHILE code_exists LOOP
      random_num := 100 + FLOOR(RANDOM() * 900);
      new_code := base_code || random_num::TEXT;
      
      -- Check if code exists for this business
      SELECT EXISTS(
        SELECT 1 FROM customers 
        WHERE business_id = customer_record.business_id 
        AND referral_code = new_code
      ) INTO code_exists;
    END LOOP;
    
    -- Update customer with new code
    UPDATE customers 
    SET referral_code = new_code 
    WHERE id = customer_record.id;
    
    RAISE NOTICE 'Generated code % for customer %', new_code, customer_record.id;
  END LOOP;
END $$;

-- Verify results
SELECT COUNT(*) as total_customers, 
       COUNT(referral_code) as customers_with_codes,
       COUNT(*) - COUNT(referral_code) as customers_without_codes
FROM customers;