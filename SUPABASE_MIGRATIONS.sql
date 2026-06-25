-- ═══════════════════════════════════════════════════════════════════
-- FINERP — SUPABASE MIGRATIONS
-- Run each step one at a time in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- STEP 1: Role Integrity & RLS Hardening
-- ───────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';
UPDATE public.company_users SET role = 'bdm'   WHERE role = 'bd';

UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

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

ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

CREATE OR REPLACE FUNCTION public.is_owner_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_member_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN public.is_member_of_company(p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

DROP POLICY IF EXISTS "Users can view members of their company"       ON public.company_users;
DROP POLICY IF EXISTS "Users can always view their own membership"    ON public.company_users;
DROP POLICY IF EXISTS "Owners can manage users"                       ON public.company_users;
DROP POLICY IF EXISTS "company_users_self_view"                       ON public.company_users;
DROP POLICY IF EXISTS "company_users_owner_view"                      ON public.company_users;
DROP POLICY IF EXISTS "company_users_select"                          ON public.company_users;
DROP POLICY IF EXISTS "company_users_manage"                          ON public.company_users;

DROP POLICY IF EXISTS "Company members can view company"              ON public.companies;
DROP POLICY IF EXISTS "companies_member_view"                         ON public.companies;
DROP POLICY IF EXISTS "Owners can always see their created companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select"                              ON public.companies;
DROP POLICY IF EXISTS "companies_owner_view"                          ON public.companies;

CREATE POLICY "company_users_select"
  ON public.company_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_owner_of_company(company_id)
  );

CREATE POLICY "company_users_manage"
  ON public.company_users FOR ALL
  USING (public.is_owner_of_company(company_id));

CREATE POLICY "companies_select"
  ON public.companies FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_member_of_company(id)
  );

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- STEP 2: Invite Logic & Usage Tracking
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS max_uses   INTEGER DEFAULT 1;

DROP FUNCTION IF EXISTS public.generate_company_invite(uuid, text);

CREATE OR REPLACE FUNCTION public.generate_company_invite(
  p_company_id uuid,
  p_role       text,
  p_max_uses   integer DEFAULT 1
)
RETURNS json AS $$
DECLARE
  v_code   text;
  v_invite record;
BEGIN
  IF NOT public.is_company_owner(p_company_id) THEN
    RAISE EXCEPTION 'Not authorized. Only owners can generate invite codes.';
  END IF;

  v_code := upper(substring(md5(random()::text) from 1 for 6));

  INSERT INTO public.company_invites (company_id, code, role, max_uses, expires_at)
  VALUES (p_company_id, v_code, p_role, p_max_uses, now() + interval '30 days')
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'id',       v_invite.id,
    'code',     v_invite.code,
    'role',     v_invite.role,
    'max_uses', v_invite.max_uses
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.join_company_by_invite(
  p_code    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_invite         record;
  v_company        record;
  v_user_id        uuid;
  v_already_member boolean;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to join company';
  END IF;

  SELECT * INTO v_invite
  FROM public.company_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND usage_count < max_uses
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or fully used invite code';
  END IF;

  v_already_member := EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = v_invite.company_id AND user_id = v_user_id
  );

  IF NOT v_already_member THEN
    UPDATE public.company_invites
    SET usage_count = usage_count + 1
    WHERE id = v_invite.id;
  END IF;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_invite.company_id;

  RETURN json_build_object(
    'id',   v_company.id,
    'name', v_company.name,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_invite(uuid, text, integer)  TO authenticated;

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- STEP 3: Dual-ID Schema (Deliveries & Merchandise)
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();

UPDATE public.deliveries SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

ALTER TABLE public.deliveries ALTER COLUMN uuid_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deliveries'::regclass
      AND contype = 'u'
      AND conname IN ('deliveries_uuid_id_key', 'deliveries_uuid_id_unique')
  ) THEN
    ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_uuid_id_key UNIQUE (uuid_id);
  END IF;
END $$;

ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS delivery_uuid UUID;

UPDATE public.merchandise m
SET delivery_uuid = d.uuid_id
FROM public.deliveries d
WHERE m.delivery_id = d.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchandise_delivery_uuid_fkey'
      AND conrelid = 'public.merchandise'::regclass
  ) THEN
    ALTER TABLE public.merchandise
      ADD CONSTRAINT merchandise_delivery_uuid_fkey
      FOREIGN KEY (delivery_uuid) REFERENCES public.deliveries(uuid_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- STEP 4: Module Permissions Column
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS module_permissions JSONB;


-- ───────────────────────────────────────────────────────────────────
-- STEP 5: RLS Hotfix — admin infinite-loading after Step 1
--
-- Root cause: companies_select used is_member_of_company() which
-- internally queries company_users. company_users_manage (FOR ALL)
-- in turn calls is_owner_of_company() which queries companies —
-- creating a circular RLS dependency that Supabase silently kills.
-- The companies query returns 0 rows for admin → PGRST116 error →
-- fetchCompanyAndRole falls back → role:null → NoRoleScreen → sign-out.
--
-- Fix A: Scope company_users_manage to write operations only (remove
--        the accidental SELECT coverage of FOR ALL).
-- Fix B: Replace is_member_of_company() in companies_select with a
--        direct inline subquery. For admin's own row the subquery
--        filters on user_id = auth.uid() which short-circuits the
--        company_users RLS before is_owner_of_company is ever called,
--        breaking the circular dependency.
-- ───────────────────────────────────────────────────────────────────

-- Fix A
DROP POLICY IF EXISTS "company_users_manage" ON public.company_users;

CREATE POLICY "company_users_insert"
  ON public.company_users FOR INSERT
  WITH CHECK (public.is_owner_of_company(company_id));

CREATE POLICY "company_users_update"
  ON public.company_users FOR UPDATE
  USING  (public.is_owner_of_company(company_id))
  WITH CHECK (public.is_owner_of_company(company_id));

CREATE POLICY "company_users_delete"
  ON public.company_users FOR DELETE
  USING  (public.is_owner_of_company(company_id));

-- Fix B
DROP POLICY IF EXISTS "companies_select" ON public.companies;

CREATE POLICY "companies_select"
  ON public.companies FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT company_id
      FROM   public.company_users
      WHERE  user_id = auth.uid()
    )
  );
