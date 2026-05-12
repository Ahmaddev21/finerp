-- Schema Migration V5: Production Enhancements
-- Soft Delete, Bank Reconciliation, and Period Locking

BEGIN;

--------------------------------------------------------------------------------
-- 1. ADD SOFT DELETE & RECONCILIATION FLAGS TO TRANSACTIONS
--------------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false;

-- Add index to improve query performance for active records
CREATE INDEX IF NOT EXISTS idx_transactions_is_deleted ON public.transactions(is_deleted) WHERE NOT is_deleted;

--------------------------------------------------------------------------------
-- 2. ADD PERIOD LOCK TO COMPANIES
--------------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS lock_date DATE;

--------------------------------------------------------------------------------
-- 3. UPDATE DB TRIGGERS: BLOCK MODIFICATIONS IN LOCKED PERIODS
--------------------------------------------------------------------------------
-- We will add a trigger that checks the company's lock_date against the transaction date

CREATE OR REPLACE FUNCTION public.check_transaction_lock()
RETURNS trigger AS $$
DECLARE
  v_lock_date DATE;
  v_transaction_date DATE;
  v_company_id UUID;
BEGIN
  -- Get the company_id and date depending on operation type
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
    v_transaction_date := OLD.date;
  ELSE
    v_company_id := NEW.company_id;
    v_transaction_date := NEW.date;
  END IF;

  -- Get the company's lock date
  SELECT lock_date INTO v_lock_date
  FROM public.companies
  WHERE id = v_company_id;

  -- If lock date exists and transaction belongs to locked period
  IF v_lock_date IS NOT NULL AND v_transaction_date <= v_lock_date THEN
    -- Prevent the action
    RAISE EXCEPTION 'This accounting period is locked (Lock Date: %). Modifications are not permitted.', v_lock_date;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger before INSERT, UPDATE, or DELETE on transactions
DROP TRIGGER IF EXISTS trg_enforce_period_lock ON public.transactions;
CREATE TRIGGER trg_enforce_period_lock
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transaction_lock();

--------------------------------------------------------------------------------
-- 4. UPDATE PERMISSIONS FOR NEW COLUMNS
--------------------------------------------------------------------------------

-- Ensure the new columns in connections/transactions are broadcasted safely via RLS
-- (They will inherit the existing RLS policies of the schema automatically)

COMMIT;
