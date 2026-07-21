-- ═══════════════════════════════════════════════════════════════════
-- Money Requisition Module — digital replacement for the paper
-- "Money Requisition" form (Owner creates → Admin accepts/rejects)
-- Access: Owner and Admin ONLY (enforced at RLS + frontend simultaneously)
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create money_requisitions table
CREATE TABLE IF NOT EXISTS public.money_requisitions (
  id              text        PRIMARY KEY,
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  pay_to          text        NOT NULL,
  description     text        NOT NULL,
  amount          numeric     NOT NULL,
  remarks         text,
  status          text        NOT NULL DEFAULT 'pending',
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mrq_status_check CHECK (
    status IN ('pending', 'accepted', 'rejected')
  ),
  CONSTRAINT mrq_amount_check CHECK (amount > 0)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS mrq_company_status_idx
  ON public.money_requisitions (company_id, status);

CREATE INDEX IF NOT EXISTS mrq_company_created_idx
  ON public.money_requisitions (company_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.money_requisitions ENABLE ROW LEVEL SECURITY;

-- 4. Drop stale policies before recreating
DROP POLICY IF EXISTS "mrq_select" ON public.money_requisitions;
DROP POLICY IF EXISTS "mrq_insert" ON public.money_requisitions;
DROP POLICY IF EXISTS "mrq_update" ON public.money_requisitions;
DROP POLICY IF EXISTS "mrq_delete" ON public.money_requisitions;

-- 4a. SELECT — owner/admin of same company ONLY
CREATE POLICY "mrq_select" ON public.money_requisitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = money_requisitions.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 4b. INSERT — owner only (owner authorizes/creates the requisition)
CREATE POLICY "mrq_insert" ON public.money_requisitions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = money_requisitions.company_id
        AND cu.role = 'owner'
    )
  );

-- 4c. UPDATE — owner/admin (admin accepts/rejects; owner can edit/withdraw)
CREATE POLICY "mrq_update" ON public.money_requisitions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = money_requisitions.company_id
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = money_requisitions.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 4d. DELETE — owner only
CREATE POLICY "mrq_delete" ON public.money_requisitions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = money_requisitions.company_id
        AND cu.role = 'owner'
    )
  );

-- 5. Enable realtime for this table (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE money_requisitions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_mrq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS money_requisitions_updated_at ON public.money_requisitions;
CREATE TRIGGER money_requisitions_updated_at
  BEFORE UPDATE ON public.money_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_mrq_updated_at();

-- 7. Verification output
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'money_requisitions'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'money_requisitions'
ORDER BY policyname;
