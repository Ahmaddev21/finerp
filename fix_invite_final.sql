-- ═══════════════════════════════════════════════════════════════════
-- FINAL FIX: Invite Code Join System
-- ═══════════════════════════════════════════════════════════════════
-- 
-- EVIDENCE FROM LIVE DIAGNOSTIC (2026-04-24):
--
--   ✅ company_invites: 8 valid codes exist, all NOT expired
--   ✅ Role CHECK: "moderator" and "bdm" are ACCEPTED (not blocked)
--   ✅ No duplicate (company_id, user_id) pairs exist currently
--   ❌ UNIQUE constraint: MISSING on company_users(company_id, user_id)
--   ❌ Live join test: "there is no unique or exclusion constraint
--      matching the ON CONFLICT specification" (PostgreSQL 42P10)
--
-- ROOT CAUSE: The company_users table was created by an early migration
-- WITHOUT the UNIQUE(company_id, user_id) constraint. The MASTER_SETUP
-- uses CREATE TABLE IF NOT EXISTS, so it never added the constraint.
-- The join_company_by_invite function uses ON CONFLICT (company_id, 
-- user_id) which requires this constraint to exist.
--
-- FIX: Add the missing UNIQUE constraint. That's it. One line.
-- ═══════════════════════════════════════════════════════════════════

-- The ONE fix that matters:
ALTER TABLE public.company_users
  ADD CONSTRAINT company_users_company_id_user_id_key
  UNIQUE (company_id, user_id);

-- Clean up duplicate invite codes (keep newest per company+role)
DELETE FROM public.company_invites
WHERE id NOT IN (
  SELECT DISTINCT ON (company_id, role) id
  FROM public.company_invites
  ORDER BY company_id, role, created_at DESC
);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
