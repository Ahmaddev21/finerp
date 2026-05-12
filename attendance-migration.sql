-- ═══════════════════════════════════════════════════════════════════
-- Time Keeping Module — Attendance Records Migration
-- Access: Owner and Admin ONLY (enforced at RLS + frontend simultaneously)
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id              text        PRIMARY KEY,
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable: not all employees need accounts
  employee_name   text        NOT NULL,
  role            text        NOT NULL,
  date            date        NOT NULL,
  check_in        time,
  check_out       time,
  status          text        NOT NULL DEFAULT 'present',
  leave_reason    text,
  notes           text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_status_check CHECK (
    status IN ('present', 'absent', 'late', 'half_day', 'leave')
  ),
  CONSTRAINT attendance_role_check CHECK (
    role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern')
  )
  -- unique per employee name + date enforced via index below
);

-- 2. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS attendance_company_date_idx
  ON public.attendance_records (company_id, date DESC);

CREATE INDEX IF NOT EXISTS attendance_status_idx
  ON public.attendance_records (company_id, status);

-- Case-insensitive unique: one record per employee name per day (allows any name, not just system accounts)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_unique_name_date
  ON public.attendance_records (company_id, LOWER(employee_name), date);

-- If you already ran an earlier version of this migration, apply these fixes:
ALTER TABLE public.attendance_records ALTER COLUMN employee_id DROP NOT NULL;
DROP INDEX IF EXISTS attendance_employee_date_idx;

-- 3. Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- 4. Drop any stale policies before recreating
DROP POLICY IF EXISTS "attendance_select" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_delete" ON public.attendance_records;

-- 4a. SELECT — owner/admin of the same company ONLY
--     NOTE: deliberately does NOT use is_company_member() because that includes all roles.
--     This correlated EXISTS check is the strictest isolation available without a custom function.
CREATE POLICY "attendance_select" ON public.attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = attendance_records.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 4b. INSERT — owner/admin only, company_id must match authenticated user's company
CREATE POLICY "attendance_insert" ON public.attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = attendance_records.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 4c. UPDATE — owner/admin only
CREATE POLICY "attendance_update" ON public.attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = attendance_records.company_id
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = attendance_records.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 4d. DELETE — owner/admin only
CREATE POLICY "attendance_delete" ON public.attendance_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id    = auth.uid()
        AND cu.company_id = attendance_records.company_id
        AND cu.role IN ('owner', 'admin')
    )
  );

-- 5. Enable realtime for this table (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();

-- 7. Verification output
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendance_records'
ORDER BY ordinal_position;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'attendance_records'
ORDER BY policyname;
