-- ═══════════════════════════════════════════════════════════════
-- FIX: audit_logs_action_check constraint mismatch
-- ---------------------------------------------------------------
-- Root Cause:
--   The `audit_logs` table has a check constraint allowing only:
--     ('CREATE', 'UPDATE', 'DELETE')
--   However, the `log_financial_change()` DB trigger writes
--   TG_OP directly, which PostgreSQL returns as 'INSERT' (not
--   'CREATE'). Every transaction INSERT violated the constraint.
--
-- Fix:
--   1. Drop the old restrictive constraint.
--   2. Add a new one that accepts both 'INSERT' (from the DB
--      trigger via TG_OP) and 'CREATE' (from the app layer via
--      writeAuditLog), plus all other valid values.
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Drop the old constraint
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Step 2: Add the corrected constraint
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'CREATE'));

-- Step 3: Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
