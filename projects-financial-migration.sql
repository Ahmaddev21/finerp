-- ═══════════════════════════════════════════════════════════════════
-- FinERP: Projects — Add financial tracking columns
-- Safe to re-run — all operations use ADD COLUMN IF NOT EXISTS
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add new financial columns
--    investment      — company capital allocated to this project
--    additional_costs — misc / one-off costs not in expenses
--    payment_received — amount actually collected from the client
--    edit_count       — tracks self-correction threshold for approval workflow

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS investment       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_costs NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_received NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edit_count       INTEGER       DEFAULT 0;

-- 2. Ensure company_id exists (MASTER_SETUP already adds this, but safe to repeat)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Index for company-scoped queries
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'projects-financial-migration applied' AS status;
