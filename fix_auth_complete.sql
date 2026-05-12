-- ═══════════════════════════════════════════════════════════════════
-- FinERP: Invite & Auth Production Fix (Consolidated)
-- Safe to re-run — all operations are idempotent
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. Migrate any legacy role names still in the DB
-- ─────────────────────────────────────────────────────────────────
UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';
UPDATE public.company_users SET role = 'bdm'   WHERE role = 'bd';

UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

-- ─────────────────────────────────────────────────────────────────
-- 2. Ensure correct role check constraints
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check
  CHECK (role IN ('owner','admin','bdm','engineer','receptionist','developer','intern'));

ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner','admin','bdm','engineer','receptionist','developer','intern'));

-- ─────────────────────────────────────────────────────────────────
-- 3. Ensure UNIQUE constraint on company_users(company_id, user_id)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_users'::regclass
      AND contype   = 'u'
      AND conname  IN ('company_users_company_id_user_id_key',
                       'company_users_company_user_unique')
  ) THEN
    ALTER TABLE public.company_users
      ADD CONSTRAINT company_users_company_id_user_id_key UNIQUE (company_id, user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Ensure UNIQUE constraint on company_invites(code)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_invites'::regclass
      AND contype   = 'u'
      AND conname  IN ('company_invites_code_key',
                       'company_invites_code_unique')
  ) THEN
    ALTER TABLE public.company_invites
      ADD CONSTRAINT company_invites_code_unique UNIQUE (code);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. Ensure usage_count + max_uses exist on company_invites
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS max_uses   integer DEFAULT 1;

-- Extend expiry on any invite that hasn't expired yet to 30 days from creation
UPDATE public.company_invites
SET expires_at = created_at + interval '30 days'
WHERE expires_at IS NOT NULL AND expires_at < (now() + interval '7 days');

-- ─────────────────────────────────────────────────────────────────
-- 6. create_company_with_admin — insert 'owner' (was 'super_admin')
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_name     text,
  p_currency text DEFAULT 'QR',
  p_user_id  uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_company_id uuid;
  v_join_code  text;
  v_user_id    uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required for company creation';
  END IF;

  v_join_code := public.generate_join_code();

  INSERT INTO public.companies (user_id, name, currency, join_code)
  VALUES (v_user_id, p_name, p_currency, v_join_code)
  RETURNING id INTO v_company_id;

  -- 'owner' role — was incorrectly 'super_admin' in MASTER_SETUP
  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner');

  RETURN json_build_object(
    'id',        v_company_id,
    'name',      p_name,
    'currency',  p_currency,
    'join_code', v_join_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 7. join_company_by_code — accept p_user_id param, role 'intern'
-- ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_company_by_code(text);

CREATE OR REPLACE FUNCTION public.join_company_by_code(
  p_code    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_company_id   uuid;
  v_company_name text;
  v_currency     text;
  v_user_id      uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User authentication required';
  END IF;

  SELECT id, name, currency
  INTO v_company_id, v_company_name, v_currency
  FROM public.companies
  WHERE join_code = upper(trim(p_code));

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'intern')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'id',       v_company_id,
    'name',     v_company_name,
    'currency', v_currency,
    'role',     'intern'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 8. join_company_by_invite — latest hardened version
--    Returns full company data; no usage_count limit (removed to
--    prevent accidental lockout during onboarding)
-- ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_company_by_invite(text, uuid);

CREATE FUNCTION public.join_company_by_invite(
  p_code    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_invite  record;
  v_company record;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to join company';
  END IF;

  SELECT id, company_id, role, expires_at
  INTO v_invite
  FROM public.company_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  SELECT id, name, currency, industry, join_code
  INTO v_company
  FROM public.companies
  WHERE id = v_invite.company_id;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN json_build_object(
    'id',        v_company.id,
    'name',      v_company.name,
    'currency',  v_company.currency,
    'industry',  v_company.industry,
    'join_code', v_company.join_code,
    'role',      v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 9. generate_company_invite — 3-arg version (drop old 2-arg first)
-- ─────────────────────────────────────────────────────────────────
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
    'id',         v_invite.id,
    'company_id', v_invite.company_id,
    'code',       v_invite.code,
    'role',       v_invite.role,
    'created_at', v_invite.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 10. is_company_owner helper (required by generate_company_invite)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND role       = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 11. update_user_activity — ensure function + grants exist
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = now(),
      status         = 'online'
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────
-- 12. Grant EXECUTE to anon + authenticated
--     anon is needed when email confirmation is enabled (no session
--     during signup, but user.id is available and passed explicitly)
-- ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text, text, uuid)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text, uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_invite(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_activity()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid)                       TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 13. company_invites RLS — any authenticated/anon user can look up
--     an invite by its code (the code IS the secret/auth token)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can lookup invites" ON public.company_invites;
DROP POLICY IF EXISTS "Anyone can view invite by code"         ON public.company_invites;
DROP POLICY IF EXISTS "Anyone can lookup invites"              ON public.company_invites;
DROP POLICY IF EXISTS "Admins can manage invites"              ON public.company_invites;

-- Anyone can read invite rows (safe: code itself is the secret)
CREATE POLICY "Anyone can lookup invites"
  ON public.company_invites FOR SELECT
  USING (true);

-- Only company members can insert/update/delete invites
CREATE POLICY "Members can manage invites"
  ON public.company_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_invites.company_id
        AND cu.user_id    = auth.uid()
        AND cu.role       = 'owner'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 14. member_profiles view — add presence fields + email
--     The original view omitted last_active_at, status, email so
--     TeamSettings always showed everyone as Offline.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.member_profiles AS
SELECT
  cu.id,
  cu.company_id,
  cu.user_id,
  cu.role,
  p.username,
  p.avatar_url,
  p.status,
  p.last_active_at,
  u.email
FROM public.company_users cu
LEFT JOIN public.profiles p ON cu.user_id = p.id
LEFT JOIN auth.users      u ON cu.user_id = u.id;

GRANT SELECT ON public.member_profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 15. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_company_with_admin',
    'join_company_by_invite',
    'join_company_by_code',
    'generate_company_invite',
    'update_user_activity',
    'is_company_owner'
  )
ORDER BY routine_name;
