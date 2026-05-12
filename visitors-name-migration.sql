-- ═══════════════════════════════════════════════════════════════════
-- FinERP: Daily Visitors — Add visitor_name column + fix RLS roles
-- Safe to re-run — all operations use IF NOT EXISTS / OR REPLACE
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add visitor_name column (TEXT, nullable so existing rows are unaffected)
ALTER TABLE public.daily_visitors
  ADD COLUMN IF NOT EXISTS visitor_name TEXT;

-- 2. Drop old RLS policies that used legacy role names
DROP POLICY IF EXISTS "Users can view their company's visitors"   ON public.daily_visitors;
DROP POLICY IF EXISTS "Users can insert their company's visitors" ON public.daily_visitors;
DROP POLICY IF EXISTS "Users can delete their company's visitors" ON public.daily_visitors;

-- 3. Re-create with correct 7-role names
--    Daily Visitors visible to: owner, admin, receptionist, bdm
CREATE POLICY "Users can view their company's visitors"
  ON public.daily_visitors FOR SELECT
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin', 'receptionist', 'bdm')
    )
  );

CREATE POLICY "Users can insert their company's visitors"
  ON public.daily_visitors FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin', 'receptionist', 'bdm')
    )
  );

CREATE POLICY "Users can delete their company's visitors"
  ON public.daily_visitors FOR DELETE
  USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin', 'receptionist')
    )
  );

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'visitors-name-migration applied' AS status;
