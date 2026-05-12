-- ═══════════════════════════════════════════════════════════════════
-- Finance Workflow — Secure Owner-Only Delete with Relational Safety
-- Run AFTER finance-workflow-migration.sql + finance-workflow-completion.sql
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Supporting indexes (idempotent)
CREATE INDEX IF NOT EXISTS transactions_attachment_url_idx
  ON public.transactions (attachment_url)
  WHERE attachment_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_workflow_ref_idx
  ON public.transactions (workflow_ref)
  WHERE workflow_ref IS NOT NULL;

-- 2. owner_delete_finance_workflow RPC
--    Security model:
--      - SECURITY DEFINER runs as DB owner, so it can operate across tables
--        without fighting per-table RLS policies.
--      - First action: verify auth.uid() has role = 'owner' in company_users.
--        If not: hard EXCEPTION — cannot be bypassed by any client manipulation.
--      - Atomically: nullifies workflow_ref in linked transactions, then deletes.
--      - Returns metadata so the client decides whether to clean storage.
--      - SET search_path = public prevents search_path injection.

DROP FUNCTION IF EXISTS public.owner_delete_finance_workflow(text, uuid);

CREATE OR REPLACE FUNCTION public.owner_delete_finance_workflow(
  p_workflow_id  text,
  p_company_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  text;
  v_file_path    text;
  v_dest_id      text;
  v_dest_type    text;
  v_title        text;
  v_file_refs    integer := 0;
  v_wf_refs      integer := 0;
BEGIN
  -- ── Layer 1: Authorisation — caller must be owner of this company ──────────
  SELECT role INTO v_caller_role
  FROM public.company_users
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only the company owner can delete workflow records'
      USING ERRCODE = '42501';
  END IF;

  -- ── Layer 2: Fetch workflow metadata ───────────────────────────────────────
  SELECT file_path, destination_id, destination_type, title
  INTO   v_file_path, v_dest_id, v_dest_type, v_title
  FROM   public.finance_workflows
  WHERE  id = p_workflow_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: workflow % does not exist or belongs to a different company',
      p_workflow_id
      USING ERRCODE = 'P0002';
  END IF;

  -- ── Layer 3: File reference audit ─────────────────────────────────────────
  --    Check whether the storage path is still referenced by any accounting row.
  --    Uses dynamic column existence check so it works even if the caller
  --    hasn't run finance-workflow-completion.sql yet.

  IF v_file_path IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE  table_schema = 'public'
        AND  table_name   = 'transactions'
        AND  column_name  = 'attachment_url'
    ) THEN
      SELECT COUNT(*) INTO v_file_refs
      FROM public.transactions
      WHERE attachment_url = v_file_path
        AND company_id     = p_company_id;
    END IF;

    -- Future: extend to consultation_invoices_out, contracting_invoices_out, etc.
  END IF;

  -- ── Layer 4: Nullify workflow_ref in linked transactions ───────────────────
  --    The accounting record is preserved. Only the back-reference is cleared.

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'transactions'
      AND  column_name  = 'workflow_ref'
  ) THEN
    UPDATE public.transactions
    SET    workflow_ref = NULL
    WHERE  workflow_ref = p_workflow_id
      AND  company_id   = p_company_id;

    GET DIAGNOSTICS v_wf_refs = ROW_COUNT;
  END IF;

  -- ── Layer 5: Delete the workflow record ────────────────────────────────────
  DELETE FROM public.finance_workflows
  WHERE  id         = p_workflow_id
    AND  company_id = p_company_id;

  -- ── Return metadata for client-side storage lifecycle decision ─────────────
  RETURN jsonb_build_object(
    'deleted',             true,
    'workflow_id',         p_workflow_id,
    'title',               v_title,
    'file_path',           v_file_path,
    'file_safe_to_delete', (v_file_refs = 0) AND (v_file_path IS NOT NULL),
    'linked_entry_id',     v_dest_id,
    'linked_entry_type',   v_dest_type,
    'refs_cleared',        v_wf_refs
  );
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL    ON FUNCTION public.owner_delete_finance_workflow(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.owner_delete_finance_workflow(text, uuid) TO authenticated;

-- 3. Verification
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'owner_delete_finance_workflow';
