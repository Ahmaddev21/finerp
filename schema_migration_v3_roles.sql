-- FinERP v3 - Role-specific access codes and moderator join flow
-- Run after `schema_migration_v2.sql`

-- Keep legacy roles working while standardizing on moderator + bdm.
DO $$ BEGIN
  ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
  ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check
    CHECK (role IN ('super_admin', 'admin', 'moderator', 'bdm', 'member', 'bd'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
  ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
    CHECK (role IN ('moderator', 'bdm', 'member'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_invites_company_role
  ON public.company_invites (company_id, role);

CREATE INDEX IF NOT EXISTS idx_change_requests_company_status
  ON public.change_requests (company_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can manage invites" ON public.company_invites;
DROP POLICY IF EXISTS "Anyone can view invite by code" ON public.company_invites;

CREATE POLICY "Admins can view invites"
  ON public.company_invites FOR SELECT
  USING (public.is_company_admin(company_id));

CREATE POLICY "Admins can insert invites"
  ON public.company_invites FOR INSERT
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "Admins can update invites"
  ON public.company_invites FOR UPDATE
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "Admins can delete invites"
  ON public.company_invites FOR DELETE
  USING (public.is_company_admin(company_id));

CREATE OR REPLACE FUNCTION public.generate_company_invite(
  p_company_id uuid,
  p_role text
)
RETURNS json AS $$
DECLARE
  v_code text;
  v_invite public.company_invites;
BEGIN
  IF p_role NOT IN ('moderator', 'bdm', 'member') THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  IF NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.company_invites
  WHERE company_id = p_company_id
    AND role = p_role;

  v_code := public.generate_join_code();

  INSERT INTO public.company_invites (company_id, code, role)
  VALUES (p_company_id, v_code, p_role)
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'id', v_invite.id,
    'company_id', v_invite.company_id,
    'code', v_invite.code,
    'role', v_invite.role,
    'created_at', v_invite.created_at,
    'expires_at', v_invite.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_company_invite(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_company_by_invite(p_code text, p_user_id uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_invite public.company_invites;
  v_company public.companies;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required to join company';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.company_invites
  WHERE upper(code) = upper(trim(p_code))
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  SELECT *
  INTO v_company
  FROM public.companies
  WHERE id = v_invite.company_id;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

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
