-- ═══════════════════════════════════════════════════════════════════
-- FinERP — company_entity_wps table
-- Run in: Supabase Dashboard → SQL Editor
-- WPS (Wage Protection System) salary records per company entity.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company_entity_wps (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  entity          text           NOT NULL,
  company_id      uuid           NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  employee_name   text           NOT NULL CHECK (length(trim(employee_name)) > 0),
  bank_name       text,
  account_number  text,
  wps_amount      numeric(12,2),
  payment_month   text,          -- e.g. '2026-07'
  status          text           NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','processing','paid')),
  created_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_entity_wps_entity_company_idx
  ON public.company_entity_wps (entity, company_id);

ALTER TABLE public.company_entity_wps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view company_entity_wps"   ON public.company_entity_wps;
DROP POLICY IF EXISTS "Company members can insert company_entity_wps" ON public.company_entity_wps;
DROP POLICY IF EXISTS "Company members can update company_entity_wps" ON public.company_entity_wps;
DROP POLICY IF EXISTS "Company members can delete company_entity_wps" ON public.company_entity_wps;

CREATE POLICY "Company members can view company_entity_wps"
  ON public.company_entity_wps FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert company_entity_wps"
  ON public.company_entity_wps FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update company_entity_wps"
  ON public.company_entity_wps FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete company_entity_wps"
  ON public.company_entity_wps FOR DELETE
  USING (public.is_company_member(company_id));

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'company_entity_wps'
ORDER BY ordinal_position;
