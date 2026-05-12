-- ═══════════════════════════════════════════════════════════════════
-- Tasks Enhancement Migration
-- Adds: role-based assignment, per-user assignment, private tasks,
--       deadline enforcement (finished / unfinished statuses)
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. New columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_role    text,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_role     text,
  ADD COLUMN IF NOT EXISTS is_private          boolean DEFAULT false NOT NULL;

-- Role enum check (idempotent)
DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_assigned_to_role_check
    CHECK (assigned_to_role IN ('owner','admin','bdm','engineer','receptionist','developer','intern'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend status enum to include finished / unfinished
-- Must drop old constraint BEFORE updating rows (old constraint rejects 'finished')
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname  = 'tasks'
      AND con.contype  = 'c'
      AND con.conname LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- Now safe to migrate 'completed' → 'finished'
UPDATE public.tasks SET status = 'finished' WHERE status = 'completed';

-- Add updated constraint
DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending','in_progress','finished','unfinished'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Private-aware SELECT policy (replaces generic company member policy)
DROP POLICY IF EXISTS "Company members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select"                   ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT
  USING (
    public.is_company_member(company_id)
    AND (
      NOT is_private
      OR (
        SELECT cu.role
        FROM   public.company_users cu
        WHERE  cu.user_id    = auth.uid()
          AND  cu.company_id = tasks.company_id
        LIMIT 1
      ) IN ('owner', 'admin')
    )
  );

-- 4. INSERT policy: only owner/admin can create private tasks
DROP POLICY IF EXISTS "Company members can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert"                     ON public.tasks;

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT
  WITH CHECK (
    public.is_company_member(company_id)
    AND (
      NOT COALESCE(is_private, false)
      OR (
        SELECT cu.role
        FROM   public.company_users cu
        WHERE  cu.user_id    = auth.uid()
          AND  cu.company_id = tasks.company_id
        LIMIT 1
      ) IN ('owner', 'admin')
    )
  );

-- 5. Enable tasks in realtime publication (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Verification
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'tasks'
ORDER  BY ordinal_position;

SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'tasks'
ORDER  BY policyname;
