-- ═══════════════════════════════════════════════════════════════════
-- FinERP — company_entity_documents table
-- Run in: Supabase Dashboard → SQL Editor
-- Stores documents uploaded to the Company Details section
-- (Shareup, RAA Trading, RAA Consultancy).
-- Files are stored in the finance_attachments bucket under:
--   {company_id}/company-docs/{entity}/{timestamp}_{filename}
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company_entity_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity      text        NOT NULL,   -- 'shareup' | 'trading' | 'consultancy'
  company_id  uuid        NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  file_size   bigint,
  mime_type   text,
  uploaded_by uuid        REFERENCES auth.users ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_entity_documents_entity_company_idx
  ON public.company_entity_documents (entity, company_id);

ALTER TABLE public.company_entity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view company_entity_documents"   ON public.company_entity_documents;
DROP POLICY IF EXISTS "Company members can insert company_entity_documents" ON public.company_entity_documents;
DROP POLICY IF EXISTS "Company members can delete company_entity_documents" ON public.company_entity_documents;

CREATE POLICY "Company members can view company_entity_documents"
  ON public.company_entity_documents FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert company_entity_documents"
  ON public.company_entity_documents FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can delete company_entity_documents"
  ON public.company_entity_documents FOR DELETE
  USING (public.is_company_member(company_id));

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'company_entity_documents'
ORDER BY ordinal_position;
