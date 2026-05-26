-- Add first_name and last_name columns to customers table.
-- full_name is kept and kept in sync so all existing display code continues to work.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Backfill: split full_name on the first space.
-- "John Smith"   → first_name="John",  last_name="Smith"
-- "Mary Jo Smith"→ first_name="Mary",  last_name="Jo Smith"
-- "Prince"       → first_name="Prince", last_name=NULL
UPDATE customers
SET
  first_name = CASE
    WHEN full_name IS NULL OR trim(full_name) = '' THEN NULL
    WHEN position(' ' IN trim(full_name)) > 0
      THEN left(trim(full_name), position(' ' IN trim(full_name)) - 1)
    ELSE trim(full_name)
  END,
  last_name = CASE
    WHEN full_name IS NULL OR trim(full_name) = '' THEN NULL
    WHEN position(' ' IN trim(full_name)) > 0
      THEN trim(substring(trim(full_name) FROM position(' ' IN trim(full_name)) + 1))
    ELSE NULL
  END
WHERE full_name IS NOT NULL;
