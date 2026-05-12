-- 1. Drop existing role check constraints
ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;

-- 2. Migrate existing roles to new roles
-- super_admin -> owner
-- moderator -> admin
-- bd -> bdm
-- member -> intern (as a safe default for unassigned legacy members, or developer? We'll default them to intern to limit access until reassigned)
UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'bdm' WHERE role = 'bd';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';

UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'bdm' WHERE role = 'bd';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

-- 3. Add the new strict constraints
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

-- 4. Recreate the policy for Owners managing users (from FIX_ROLE_IDENTITY)
DROP POLICY IF EXISTS "Owners can manage users" ON public.company_users;
CREATE POLICY "Owners can manage users"
  ON public.company_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'owner'
    )
  );

-- 5. Recreate the trigger for generating invite codes to accept new roles
CREATE OR REPLACE FUNCTION generate_invite_code(p_company_id uuid, p_role text)
RETURNS json AS $$
DECLARE
  v_code text;
  v_count integer;
  v_invite record;
BEGIN
  -- Validate Role
  IF p_role NOT IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern') THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  -- Verify caller is Owner
  SELECT count(*) INTO v_count
  FROM public.company_users
  WHERE company_id = p_company_id 
    AND user_id = auth.uid() 
    AND role = 'owner';
    
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Not authorized to generate invites. Only owners can manage access codes.';
  END IF;

  -- Generate 6 character alphanumeric code
  v_code := upper(substring(md5(random()::text) from 1 for 6));

  -- Insert
  INSERT INTO public.company_invites (company_id, code, role)
  VALUES (p_company_id, v_code, p_role)
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'code', v_invite.code,
    'company_id', v_invite.company_id,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for transactions modifications (enforce bypassing for owners/admins)
CREATE OR REPLACE FUNCTION enforce_transaction_mod_rules() RETURNS trigger AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() != 'authenticated' THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_role
    FROM public.company_users
    WHERE company_id = NEW.company_id AND user_id = auth.uid();

    -- Owners/Admins/Developers can bypass restrictions
    IF v_role IN ('owner', 'admin', 'developer') THEN
        RETURN NEW;
    END IF;

    -- Interns and Receptionists cannot modify transactions
    IF v_role IN ('intern', 'receptionist', 'engineer') THEN
        RAISE EXCEPTION 'Access Denied: Your role does not have permission to modify transaction data.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Signal PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
