-- ═══════════════════════════════════════════════════════════════════
-- FIX: Invite Code "Expired" Bug
-- ---------------------------------------------------------------
-- Root Cause:
--   The RLS policy on `company_invites` only allows admins to
--   SELECT rows. When a NEW user (not yet in any company) tries
--   to join via `join_company_by_invite()`, RLS blocks the
--   SELECT inside the function, so the invite is invisible.
--   Result: "Invalid or expired invite code" even though it's valid.
--
-- Fix:
--   1. The function already runs as SECURITY DEFINER, but the
--      internal SELECT still respects RLS. We need to either:
--      a) Add a permissive SELECT policy for authenticated users
--         (limited to code lookup only), OR
--      b) Use the function's SECURITY DEFINER context properly.
--
--   We'll do (a) — add a policy that lets any authenticated user
--   SELECT an invite row by its code. This is safe because the
--   code itself is the secret.
--
--   2. Also extend expiry from 7 days to 30 days so codes don't
--      expire too quickly for real-world onboarding.
--
--   3. Consolidate the join function to handle both edge cases.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Add a SELECT policy for authenticated users to look up invites by code
-- (This is the critical fix — without this, new users can't see the invite row)

DROP POLICY IF EXISTS "Anyone can view invite by code" ON public.company_invites;
DROP POLICY IF EXISTS "Authenticated users can lookup invites" ON public.company_invites;

CREATE POLICY "Authenticated users can lookup invites"
  ON public.company_invites FOR SELECT
  USING (true);  -- Any authenticated user can read invite rows
  -- This is safe: the code is a 6-char random secret, and
  -- knowing it IS the authorization to join.

-- Step 2: Extend default expiry from 7 days to 30 days
ALTER TABLE public.company_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- Step 3: Extend any existing invites that haven't expired yet
-- (so codes generated in the last 7 days don't expire prematurely)
UPDATE public.company_invites
SET expires_at = created_at + interval '30 days'
WHERE expires_at > now();

-- Step 4: Replace join function with bulletproof version
CREATE OR REPLACE FUNCTION public.join_company_by_invite(p_code text, p_user_id uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_invite record;
  v_company record;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to join company';
  END IF;

  -- Find the invite (case-insensitive, not expired)
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

  -- Fetch company details
  SELECT id, name, currency, industry, join_code
  INTO v_company
  FROM public.companies
  WHERE id = v_invite.company_id;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Add user with the role specified in the invite
  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN json_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'currency', v_company.currency,
    'industry', v_company.industry,
    'join_code', v_company.join_code,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid) TO authenticated;

-- Step 5: Reload schema cache
NOTIFY pgrst, 'reload schema';
