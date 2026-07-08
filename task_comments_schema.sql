-- ═══════════════════════════════════════════════════════════════════
-- FinERP — task_comments table
-- Run in: Supabase Dashboard → SQL Editor
-- Private comment thread on each task, visible to owner + admin only.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.task_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text        NOT NULL,
  body        text        NOT NULL CHECK (length(trim(body)) > 0),
  edited_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_company_idx
  ON public.task_comments (task_id, company_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_update" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON public.task_comments;

-- SELECT: owner and admin only
CREATE POLICY "task_comments_select"
  ON public.task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id    = auth.uid()
        AND company_id = task_comments.company_id
        AND role IN ('owner', 'admin')
    )
  );

-- INSERT: owner/admin, and must be posting as themselves
CREATE POLICY "task_comments_insert"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id    = auth.uid()
        AND company_id = task_comments.company_id
        AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: can only edit own comments (owner/admin role still required)
CREATE POLICY "task_comments_update"
  ON public.task_comments FOR UPDATE
  USING (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id    = auth.uid()
        AND company_id = task_comments.company_id
        AND role IN ('owner', 'admin')
    )
  );

-- DELETE: owner can delete anyone's comment; admin can delete only their own
CREATE POLICY "task_comments_delete"
  ON public.task_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id    = auth.uid()
        AND company_id = task_comments.company_id
        AND role = 'owner'
    )
    OR (
      auth.uid() = author_id
      AND EXISTS (
        SELECT 1 FROM public.company_users
        WHERE user_id    = auth.uid()
          AND company_id = task_comments.company_id
          AND role = 'admin'
      )
    )
  );

-- Add to realtime publication so comments appear live
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'task_comments'
ORDER BY ordinal_position;
