-- Add per-customer deposit requirement flag
ALTER TABLE customers ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT false;
