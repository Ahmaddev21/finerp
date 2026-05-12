-- ═══════════════════════════════════════════════════════════════════
-- FinERP Role-Based Invitation Functions
-- Run this in Supabase SQL Editor to fix the Join Code error
-- ═══════════════════════════════════════════════════════════════════

-- 1. Function to Generate an Invite (Admin only)
CREATE OR REPLACE FUNCTION public.generate_company_invite(p_company_id uuid, p_role text)
RETURNS json AS $$
DECLARE
  v_code text;
  v_invite_id uuid;
BEGIN
  -- Generate a random 6-char code
  v_code := public.generate_join_code();
  
  INSERT INTO public.company_invites (company_id, code, role)
  VALUES (p_company_id, v_code, p_role)
  RETURNING id INTO v_invite_id;

  RETURN json_build_object(
    'id', v_invite_id,
    'company_id', p_company_id,
    'code', v_code,
    'role', p_role,
    'created_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to Join by Invite (Used by Signup)
CREATE OR REPLACE FUNCTION public.join_company_by_invite(p_code text, p_user_id uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_invite_id uuid;
  v_company_id uuid;
  v_role text;
  v_user_id uuid;
  v_company_name text;
  v_currency text;
BEGIN
  -- Validate the invite (case insensitive)
  SELECT id, company_id, role INTO v_invite_id, v_company_id, v_role
  FROM public.company_invites
  WHERE UPPER(code) = UPPER(p_code)
  AND (expires_at IS NULL OR expires_at > now());

  IF v_invite_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User authentication required';
  END IF;

  -- Fetch company details
  SELECT name, currency INTO v_company_name, v_currency
  FROM public.companies
  WHERE id = v_company_id;

  -- Add user with the role specified in the invite
  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, v_role)
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = v_role;

  RETURN json_build_object(
    'id', v_company_id,
    'name', v_company_name,
    'currency', v_currency,
    'role', v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
