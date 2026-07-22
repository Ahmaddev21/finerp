-- ═══════════════════════════════════════════════════════════════════
-- Security fix — public.member_profiles was leaking cross-tenant PII
-- AND flagged by Supabase's linter as a "Security Definer View".
--
-- Root cause: RLS_FINAL_PEACE.sql set WITH (security_invoker = false)
-- on this view so its join into auth.users would work (authenticated
-- has no grants on auth.users directly). fix_auth_complete.sql later
-- added u.email on top of that. A view with security_invoker = false
-- runs as its OWNER (elevated privilege) for every caller, regardless
-- of who's actually querying it — that's exactly what the Supabase
-- linter's "Security Definer View" warning is about. Combined with
-- GRANT SELECT ... TO authenticated and no row filter, ANY logged-in
-- user in ANY company could read every other company's member emails
-- via the REST API directly (the app's client-side .eq('company_id',
-- ...) filters only protect the UI, not the underlying endpoint).
--
-- A first pass patched this by adding a WHERE auth.uid() filter but
-- kept security_invoker = false — that closes the leak but the view
-- is still technically "security definer" and still trips the
-- linter, and a future edit that drops the WHERE clause would
-- silently reopen the hole with no RLS backstop.
--
-- Real fix (Supabase's own recommended pattern):
--   1. member_profiles goes back to a PLAIN view, with the
--      auth.users/email join removed entirely, AND explicitly
--      WITH (security_invoker = true). Note: omitting security_invoker
--      does NOT default to invoker-mode — Postgres defaults it to
--      false (owner/definer privileges) unless set to true explicitly.
--      An earlier pass here missed this and only removed the old
--      `security_invoker = false` without adding `= true`, so the
--      view kept running as its owner and the linter kept flagging
--      it correctly. With `= true` set, and with the auth.users join
--      gone, it now runs under the querying user's own permissions,
--      so normal RLS on company_users (already company-scoped — see
--      "Users can view members of their company" policy) and profiles
--      applies naturally.
--   2. Reading email (which genuinely requires elevated access, since
--      auth.users is intentionally locked down) moves into a
--      SECURITY DEFINER *function*, not a view. The function has an
--      explicit, auditable authorization check in its body
--      (is_company_member) that runs on every call no matter how it's
--      invoked — unlike a view, it can't be bypassed by requesting
--      different columns or a different filter via the REST API.
--      Functions with an explicit auth check are the sanctioned
--      Supabase idiom for this and are not flagged by the linter.
--
-- App-side: only src/services/auth.ts's fetchCompanyMembers() (used
-- by the owner-only Team Settings page) needs email — it's switched
-- to call the new RPC. Every other caller of member_profiles
-- (useAttendance.ts, useTasks.ts, useChangeRequests.ts) only ever
-- selects user_id/role/username and is unaffected.
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. member_profiles — plain view, no elevated privilege, no email
--    CREATE OR REPLACE VIEW cannot drop columns from an existing view
--    (only append them), and this rewrite removes the `email` column
--    that earlier versions had — so the old view must be dropped first.
DROP VIEW IF EXISTS public.member_profiles;

CREATE VIEW public.member_profiles
WITH (security_invoker = true)
AS
SELECT
  cu.id,
  cu.company_id,
  cu.user_id,
  cu.role,
  p.username,
  p.avatar_url,
  p.status,
  p.last_active_at
FROM public.company_users cu
LEFT JOIN public.profiles p ON cu.user_id = p.id;

GRANT SELECT ON public.member_profiles TO authenticated;
REVOKE SELECT ON public.member_profiles FROM anon;

-- 2. get_company_member_emails — SECURITY DEFINER function with an
--    explicit, in-body authorization check (reuses the existing
--    is_company_member() helper). This is the only place auth.users
--    email is ever exposed, and only to a caller who actually belongs
--    to the requested company.
CREATE OR REPLACE FUNCTION public.get_company_member_emails(p_company_id uuid)
RETURNS TABLE (
  id             uuid,
  company_id     uuid,
  user_id        uuid,
  role           text,
  username       text,
  avatar_url     text,
  status         text,
  last_active_at timestamptz,
  email          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: not a member of this company';
  END IF;

  RETURN QUERY
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
  LEFT JOIN auth.users      u ON cu.user_id = u.id
  WHERE cu.company_id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_member_emails(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_company_member_emails(uuid) FROM anon;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────

-- member_profiles should now show reloptions containing security_invoker=true
-- (this is the actual proof the linter warning is resolved — an empty/null
-- reloptions here means it's still running in definer-mode, NOT fixed)
SELECT c.relname, c.reloptions
FROM pg_class c
WHERE c.relname = 'member_profiles';

-- Grants: authenticated should have SELECT on the view, anon should not
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'member_profiles'
ORDER BY grantee;

-- Function should exist as SECURITY DEFINER
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_company_member_emails';
