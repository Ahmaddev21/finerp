-- ─────────────────────────────────────────────────────────────────────
-- Run these in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────

-- Allow Word (.doc / .docx) uploads in the finance_attachments bucket
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
WHERE name = 'finance_attachments'
  AND NOT (allowed_mime_types @> ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- Verify what the bucket now allows:
SELECT name, allowed_mime_types FROM storage.buckets WHERE name = 'finance_attachments';

-- ─────────────────────────────────────────────────────────────────────
-- Finance Workflow — Completion columns + RPC (run if not yet done)
-- finance-workflow-completion.sql
-- ─────────────────────────────────────────────────────────────────────

-- 1. Add destination-tracking columns to finance_workflows
ALTER TABLE public.finance_workflows
  ADD COLUMN IF NOT EXISTS destination_type text,
  ADD COLUMN IF NOT EXISTS destination_id   text,
  ADD COLUMN IF NOT EXISTS completed_by     uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add workflow back-reference + attachment columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS workflow_ref    text,
  ADD COLUMN IF NOT EXISTS attachment_url  text;

-- 3. Ensure finance_workflows is in the realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE finance_workflows;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- Finance Workflow — Secure delete RPC (run if not yet done)
-- finance-workflow-delete.sql
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS transactions_attachment_url_idx
  ON public.transactions (attachment_url)
  WHERE attachment_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_workflow_ref_idx
  ON public.transactions (workflow_ref)
  WHERE workflow_ref IS NOT NULL;

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
  SELECT role INTO v_caller_role
  FROM public.company_users
  WHERE user_id = auth.uid() AND company_id = p_company_id;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only the company owner can delete workflow records'
      USING ERRCODE = '42501';
  END IF;

  SELECT file_path, destination_id, destination_type, title
  INTO   v_file_path, v_dest_id, v_dest_type, v_title
  FROM   public.finance_workflows
  WHERE  id = p_workflow_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: workflow % does not exist or belongs to a different company',
      p_workflow_id USING ERRCODE = 'P0002';
  END IF;

  IF v_file_path IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'attachment_url'
    ) THEN
      SELECT COUNT(*) INTO v_file_refs
      FROM public.transactions
      WHERE attachment_url = v_file_path AND company_id = p_company_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'workflow_ref'
  ) THEN
    UPDATE public.transactions
    SET workflow_ref = NULL
    WHERE workflow_ref = p_workflow_id AND company_id = p_company_id;
    GET DIAGNOSTICS v_wf_refs = ROW_COUNT;
  END IF;

  DELETE FROM public.finance_workflows
  WHERE id = p_workflow_id AND company_id = p_company_id;

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

REVOKE ALL    ON FUNCTION public.owner_delete_finance_workflow(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.owner_delete_finance_workflow(text, uuid) TO authenticated;

-- Verify:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'finance_workflows'
  AND column_name IN ('destination_type','destination_id','completed_by')
ORDER BY column_name;

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'owner_delete_finance_workflow';
