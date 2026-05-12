-- ═══════════════════════════════════════════════════════════════════
-- FIX: Invite code STILL failing after RLS fix
-- ---------------------------------------------------------------
-- Root Cause (confirmed):
--   After signUp() with email confirmation enabled, the Supabase
--   client has NO session (data.session is null). The client runs
--   as the `anon` role. But join_company_by_invite is only granted
--   to `authenticated`, so the RPC call silently fails with a
--   permission error. The code falls through to the legacy
--   join_company_by_code, which also can't find the invite code
--   (it looks in companies.join_code, not company_invites.code).
--
-- Fix:
--   Grant EXECUTE on both join functions to the `anon` role.
--   The functions are SECURITY DEFINER (run as postgres), so they
--   handle their own auth internally via p_user_id parameter.
-- ═══════════════════════════════════════════════════════════════════

-- Grant the invite join function to anon (for pre-confirmation signups)
GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid) TO authenticated;

-- Grant the legacy join function to anon too
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO authenticated;

-- Also grant create_company_with_admin to anon (same scenario)
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text, text, uuid) TO authenticated;

-- Ensure the company_invites SELECT policy allows anon too
DROP POLICY IF EXISTS "Authenticated users can lookup invites" ON public.company_invites;
DROP POLICY IF EXISTS "Anyone can view invite by code" ON public.company_invites;

-- This policy uses `true` which works for both anon and authenticated
CREATE POLICY "Anyone can lookup invites"
  ON public.company_invites FOR SELECT
  USING (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
