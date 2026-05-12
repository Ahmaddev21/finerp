-- ═══════════════════════════════════════════════════════════════════
-- Finance Workflow Module — Document Transfer & Processing Migration
-- Access: Owner and Admin ONLY (enforced at RLS + frontend simultaneously)
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ensure finance_attachments bucket allows PDFs up to 10 MB
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'finance_attachments',
  'finance_attachments',
  false,
  false,
  10485760, -- 10 MB (was 2 MB — PDFs need more headroom)
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. Create finance_workflows table
CREATE TABLE IF NOT EXISTS public.finance_workflows (
  id              text        PRIMARY KEY,
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  category        text        NOT NULL DEFAULT 'Other',
  description     text,
  status          text        NOT NULL DEFAULT 'pending',
  file_path       text,                           -- storage object path
  file_name       text,                           -- original filename for display
  file_size       bigint,                         -- bytes
  uploaded_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text,
  transaction_ref text,                           -- linked accounting record reference
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fw_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'rejected')
  ),
  CONSTRAINT fw_category_check CHECK (
    category IN ('Invoice', 'Expense', 'Salary', 'Contract', 'Receipt', 'Other')
  )
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS fw_company_status_idx
  ON public.finance_workflows (company_id, status);

CREATE INDEX IF NOT EXISTS fw_company_created_idx
  ON public.finance_workflows (company_id, created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.finance_workflows ENABLE ROW LEVEL SECURITY;

-- 5. Drop stale policies before recreating
DROP POLICY IF EXISTS "fw_select" ON public.finance_workflows;
DROP POLICY IF EXISTS "fw_insert" ON public.finance_workflows;
DROP POLICY IF EXISTS "fw_update" ON public.finance_workflows;
DROP POLICY IF EXISTS "fw_delete" ON public.finance_workflows;

-- 5a. SELECT — owner/admin of same company ONLY
CREATE POLICY "fw_select" ON public.finance_workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = finance_workflows.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 5b. INSERT — owner/admin only
CREATE POLICY "fw_insert" ON public.finance_workflows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = finance_workflows.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 5c. UPDATE — owner/admin only
CREATE POLICY "fw_update" ON public.finance_workflows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = finance_workflows.company_id
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = finance_workflows.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 5d. DELETE — owner only (admins process, not delete)
CREATE POLICY "fw_delete" ON public.finance_workflows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = finance_workflows.company_id
        AND cu.role = 'owner'
    )
  );

-- 6. Enable realtime for this table (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE finance_workflows;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_fw_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_workflows_updated_at ON public.finance_workflows;
CREATE TRIGGER finance_workflows_updated_at
  BEFORE UPDATE ON public.finance_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_fw_updated_at();

-- 8. Verification output
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'finance_workflows'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'finance_workflows'
ORDER BY policyname;
