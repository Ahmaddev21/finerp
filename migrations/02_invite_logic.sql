-- ───────────────────────────────────────────────────────────────────
-- PHASE 2: INVITE LOGIC & USAGE TRACKING
-- Fixes: old 2-arg generate_company_invite not replaced (coexisted
--        with broken role validation), usage count consumed by
--        existing members.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Add usage tracking columns to company_invites
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS max_uses   INTEGER DEFAULT 1;

-- 2. Drop old 2-arg generate_company_invite.
--    CREATE OR REPLACE would NOT replace it (different signature = different overload).
--    That old function has hardcoded role check for ('moderator','bdm','member') which
--    would reject every new role. Must be dropped first.
DROP FUNCTION IF EXISTS public.generate_company_invite(uuid, text);

-- 3. Hardened Invite Generation (3-arg version — owner only)
CREATE OR REPLACE FUNCTION public.generate_company_invite(
  p_company_id uuid,
  p_role text,
  p_max_uses integer DEFAULT 1
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


-- 4. Hardened Join Logic
--    Fix: usage_count is only incremented for genuinely new members.
--         Existing members re-using the code to change role do not
--         consume an invite slot (prevents invite exhaustion attacks).
CREATE OR REPLACE FUNCTION public.join_company_by_invite(
  p_code    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_invite          record;
  v_company         record;
  v_user_id         uuid;
  v_already_member  boolean;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to join company';
  END IF;

  -- Find a valid, unexpired, not-fully-used invite
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

  -- Only consume an invite slot for a genuinely new member.
  -- Existing members using the code to change role do not exhaust the count.
  v_already_member := EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = v_invite.company_id AND user_id = v_user_id
  );

  IF NOT v_already_member THEN
    UPDATE public.company_invites
    SET usage_count = usage_count + 1
    WHERE id = v_invite.id;
  END IF;

  -- Upsert membership (safe because Phase 1 added the unique constraint)
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


GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_invite(uuid, text, integer) TO authenticated;

COMMIT;
