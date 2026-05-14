-- ─────────────────────────────────────────────────────────────────────────────
-- Merchandise Tracking Extension
-- Adds two tables:
--   merchandise_stock   — inventory batches received from provider
--   merchandise_returns — audit trail of items returned by employees
--
-- The existing `merchandise` table (per-employee allocation snapshot) is
-- NOT modified. Returns reduce that record in-place; merchandise_returns
-- preserves the history.
--
-- Available Stock formula (per item type):
--   available = SUM(merchandise_stock.received_qty)
--             - SUM(merchandise.<item>_qty across all employees)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Stock batches received from provider
CREATE TABLE IF NOT EXISTS public.merchandise_stock (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid        REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  item_type     text        NOT NULL
                            CHECK (item_type IN (
                              't_shirt','trouser','helmet',
                              'safety_gear','thermal_bag','gillet','other'
                            )),
  item_name     text        NOT NULL,
  provider      text        NOT NULL DEFAULT 'SNOONU',
  received_qty  integer     NOT NULL CHECK (received_qty > 0),
  received_date date        DEFAULT CURRENT_DATE,
  notes         text,
  created_by    uuid        REFERENCES auth.users,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.merchandise_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view merchandise_stock"   ON public.merchandise_stock;
DROP POLICY IF EXISTS "Company members can insert merchandise_stock" ON public.merchandise_stock;
DROP POLICY IF EXISTS "Company members can update merchandise_stock" ON public.merchandise_stock;
DROP POLICY IF EXISTS "Company members can delete merchandise_stock" ON public.merchandise_stock;

CREATE POLICY "Company members can view merchandise_stock"
  ON public.merchandise_stock FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert merchandise_stock"
  ON public.merchandise_stock FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update merchandise_stock"
  ON public.merchandise_stock FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete merchandise_stock"
  ON public.merchandise_stock FOR DELETE
  USING (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_merch_stock_company
  ON public.merchandise_stock (company_id, item_type);

-- 2. Return records (audit trail — one row per item type per return event)
CREATE TABLE IF NOT EXISTS public.merchandise_returns (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid        REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  delivery_id   text        NOT NULL,
  employee_name text        NOT NULL,
  item_type     text        NOT NULL
                            CHECK (item_type IN (
                              't_shirt','trouser','helmet',
                              'safety_gear','thermal_bag','gillet','other'
                            )),
  item_name     text        NOT NULL,
  returned_qty  integer     NOT NULL CHECK (returned_qty > 0),
  return_date   date        DEFAULT CURRENT_DATE,
  notes         text,
  created_by    uuid        REFERENCES auth.users,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.merchandise_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view merchandise_returns"   ON public.merchandise_returns;
DROP POLICY IF EXISTS "Company members can insert merchandise_returns" ON public.merchandise_returns;
DROP POLICY IF EXISTS "Company members can update merchandise_returns" ON public.merchandise_returns;
DROP POLICY IF EXISTS "Company members can delete merchandise_returns" ON public.merchandise_returns;

CREATE POLICY "Company members can view merchandise_returns"
  ON public.merchandise_returns FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert merchandise_returns"
  ON public.merchandise_returns FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update merchandise_returns"
  ON public.merchandise_returns FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete merchandise_returns"
  ON public.merchandise_returns FOR DELETE
  USING (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_merch_returns_company
  ON public.merchandise_returns (company_id, delivery_id);

-- 3. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE merchandise_stock;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE merchandise_returns;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
