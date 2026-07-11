-- ═══════════════════════════════════════════════════════════════════
-- FinERP — company_entity_employees table
-- Run in: Supabase Dashboard → SQL Editor
-- Employees per company entity (shareup / trading / consultancy).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company_entity_employees (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity      text        NOT NULL,   -- 'shareup' | 'trading' | 'consultancy'
  company_id  uuid        NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  name        text        NOT NULL CHECK (length(trim(name)) > 0),
  position    text,
  nationality text,
  id_number   text,                   -- QID or passport number
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_entity_employees_entity_company_idx
  ON public.company_entity_employees (entity, company_id);

ALTER TABLE public.company_entity_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view company_entity_employees"   ON public.company_entity_employees;
DROP POLICY IF EXISTS "Company members can insert company_entity_employees" ON public.company_entity_employees;
DROP POLICY IF EXISTS "Company members can update company_entity_employees" ON public.company_entity_employees;
DROP POLICY IF EXISTS "Company members can delete company_entity_employees" ON public.company_entity_employees;

CREATE POLICY "Company members can view company_entity_employees"
  ON public.company_entity_employees FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert company_entity_employees"
  ON public.company_entity_employees FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update company_entity_employees"
  ON public.company_entity_employees FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete company_entity_employees"
  ON public.company_entity_employees FOR DELETE
  USING (public.is_company_member(company_id));

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'company_entity_employees'
ORDER BY ordinal_position;
