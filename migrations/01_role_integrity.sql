-- ───────────────────────────────────────────────────────────────────
-- PHASE 1: ROLE INTEGRITY & HARDENING
-- Fixes: missing role migrations, redundant constraint checks,
--        RLS recursion on company_users and companies tables.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Migrate Legacy Roles in company_users
UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';
UPDATE public.company_users SET role = 'bdm'   WHERE role = 'bd';

-- Migrate Legacy Roles in company_invites
UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

-- 2. Add Critical Constraints (idempotent — checks for any unique constraint on these columns)

-- company_users: (company_id, user_id) uniqueness
-- Checks both the auto-generated name from CREATE TABLE UNIQUE(...) and our named constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_users'::regclass
      AND contype = 'u'
      AND conname IN ('company_users_company_user_unique', 'company_users_company_id_user_id_key')
  ) THEN
    ALTER TABLE public.company_users
      ADD CONSTRAINT company_users_company_user_unique UNIQUE (company_id, user_id);
  END IF;
END $$;

-- company_invites: code uniqueness
-- Checks both the auto-generated name and our named constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_invites'::regclass
      AND contype = 'u'
      AND conname IN ('company_invites_code_unique', 'company_invites_code_key')
  ) THEN
    ALTER TABLE public.company_invites
      ADD CONSTRAINT company_invites_code_unique UNIQUE (code);
  END IF;
END $$;

-- 3. Standardize role check constraints (safe now — all rows migrated above)
ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));


-- 4. Security Helper Functions (SECURITY DEFINER = bypass RLS to prevent recursion)

-- Checks ownership via companies table — does NOT query company_users, safe for company_users RLS policies.
CREATE OR REPLACE FUNCTION public.is_owner_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Checks membership via company_users — SECURITY DEFINER bypasses RLS, no recursion.
CREATE OR REPLACE FUNCTION public.is_member_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Canonical alias used by all RLS policies on data tables.
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN public.is_member_of_company(p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Used by Phase 2 invite generation (owner-only gate).
CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. Fix RLS Recursion on company_users and companies
--    Drop old policies that contained direct self-referential subqueries.

DROP POLICY IF EXISTS "Users can view members of their company"  ON public.company_users;
DROP POLICY IF EXISTS "Users can always view their own membership" ON public.company_users;
DROP POLICY IF EXISTS "Owners can manage users"                  ON public.company_users;
DROP POLICY IF EXISTS "company_users_self_view"                  ON public.company_users;
DROP POLICY IF EXISTS "company_users_owner_view"                 ON public.company_users;
DROP POLICY IF EXISTS "company_users_select"                     ON public.company_users;
DROP POLICY IF EXISTS "company_users_manage"                     ON public.company_users;

DROP POLICY IF EXISTS "Company members can view company"         ON public.companies;
DROP POLICY IF EXISTS "companies_member_view"                    ON public.companies;
DROP POLICY IF EXISTS "Owners can always see their created companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select"                         ON public.companies;
DROP POLICY IF EXISTS "companies_owner_view"                     ON public.companies;

-- Non-recursive policy for company_users:
--   Self-view uses auth.uid() directly (no table scan).
--   Owner-view uses is_owner_of_company() which queries companies table, NOT company_users.
CREATE POLICY "company_users_select"
  ON public.company_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_owner_of_company(company_id)
  );

-- Allow owners to manage (insert/update/delete) team members.
CREATE POLICY "company_users_manage"
  ON public.company_users FOR ALL
  USING (public.is_owner_of_company(company_id));

-- Non-recursive policy for companies:
--   Creator view uses user_id = auth.uid() directly.
--   Member view uses is_member_of_company() which is SECURITY DEFINER — no recursion.
CREATE POLICY "companies_select"
  ON public.companies FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_member_of_company(id)
  );

COMMIT;
