-- ═══════════════════════════════════════════════════════════════════
-- Finance Workflow — Completion & Relational Linkage Patch
-- Run AFTER finance-workflow-migration.sql
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add destination-tracking columns to finance_workflows
--    These record WHERE a completed workflow was processed to
ALTER TABLE public.finance_workflows
  ADD COLUMN IF NOT EXISTS destination_type text,   -- e.g. 'Invoice', 'Expense'
  ADD COLUMN IF NOT EXISTS destination_id   text,   -- PK of the created record
  ADD COLUMN IF NOT EXISTS completed_by     uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;   -- who processed it

-- 2. Add workflow back-reference column to transactions
--    Allows Accounting to show "From Workflow FWF-XXXX" badge
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS workflow_ref text;       -- finance_workflows.id (logical FK)

-- 3. Verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'finance_workflows'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
  AND column_name IN ('attachment_url','workflow_ref')
ORDER BY ordinal_position;
