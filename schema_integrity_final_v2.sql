-- ═══════════════════════════════════════════════════════════════════
-- FinERP v2.1: Schema Integrity, Role Migration & Dual-ID Refactor
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. ROLE MIGRATION & CLEANUP
-- ─────────────────────────────────────────
RAISE NOTICE 'Migrating legacy roles...';

UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';

UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

-- Standardize constraints
ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check 
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));


-- 2. DELIVERIES TABLE DUAL-ID REFACTOR
-- ─────────────────────────────────────────
RAISE NOTICE 'Refactoring deliveries table to use UUID internal IDs...';

-- Step A: Prepare deliveries table
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_code TEXT;
UPDATE public.deliveries SET delivery_code = id WHERE delivery_code IS NULL;

-- Step B: Handle UUID transformation
-- We need to change the PK from TEXT to UUID. This is destructive if not handled carefully.
-- 1. Add temporary UUID column
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS internal_id UUID DEFAULT gen_random_uuid();

-- 2. Update merchandise to use the new UUID
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS delivery_uuid UUID;
UPDATE public.merchandise m 
SET delivery_uuid = d.internal_id 
FROM public.deliveries d 
WHERE m.delivery_id = d.id;

-- 3. Drop constraints and swap
ALTER TABLE public.merchandise DROP CONSTRAINT IF EXISTS merchandise_delivery_id_fkey;
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_pkey CASCADE;

-- 4. Set new PK and clean up
ALTER TABLE public.deliveries ALTER COLUMN id TYPE UUID USING internal_id;
ALTER TABLE public.deliveries ADD PRIMARY KEY (id);
ALTER TABLE public.deliveries DROP COLUMN internal_id;

-- 5. Restore merchandise FK
ALTER TABLE public.merchandise DROP COLUMN delivery_id;
ALTER TABLE public.merchandise RENAME COLUMN delivery_uuid TO delivery_id;
ALTER TABLE public.merchandise ADD CONSTRAINT merchandise_delivery_id_fkey 
  FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;

-- Ensure delivery_code is unique and non-null
ALTER TABLE public.deliveries ALTER COLUMN delivery_code SET NOT NULL;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_delivery_code_key UNIQUE (delivery_code);


-- 3. RLS AUDIT & REWRITE
-- ─────────────────────────────────────────
RAISE NOTICE 'Updating RLS policies for all tables...';

-- Helper: Check if current user is an owner of the company
CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = p_company_id
    AND cu.user_id = auth.uid()
    AND cu.role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply is_company_member with SECURITY DEFINER for reliability
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = p_company_id
    AND cu.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table: company_invites
DROP POLICY IF EXISTS "Owners can manage invites" ON public.company_invites;
CREATE POLICY "Owners can manage invites"
  ON public.company_invites FOR ALL
  TO authenticated
  USING (public.is_company_owner(company_id));

DROP POLICY IF EXISTS "Authenticated users can lookup invites" ON public.company_invites;
CREATE POLICY "Authenticated users can lookup invites"
  ON public.company_invites FOR SELECT
  TO authenticated
  USING (true);

-- Table: deliveries
DROP POLICY IF EXISTS "Company members can view deliveries" ON public.deliveries;
CREATE POLICY "Company members can view deliveries" ON public.deliveries FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Company members can insert deliveries" ON public.deliveries;
CREATE POLICY "Company members can insert deliveries" ON public.deliveries FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Company members can update deliveries" ON public.deliveries;
CREATE POLICY "Company members can update deliveries" ON public.deliveries FOR UPDATE USING (public.is_company_member(company_id));

-- Table: merchandise
DROP POLICY IF EXISTS "Company members can view merchandise" ON public.merchandise;
CREATE POLICY "Company members can view merchandise" ON public.merchandise FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Company members can insert merchandise" ON public.merchandise;
CREATE POLICY "Company members can insert merchandise" ON public.merchandise FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Company members can update merchandise" ON public.merchandise;
CREATE POLICY "Company members can update merchandise" ON public.merchandise FOR UPDATE USING (public.is_company_member(company_id));


-- 4. BULLETPROOF RPCs
-- ─────────────────────────────────────────

-- Generate Invite
CREATE OR REPLACE FUNCTION public.generate_company_invite(p_company_id uuid, p_role text)
RETURNS json AS $$
DECLARE
  v_code text;
  v_invite record;
BEGIN
  -- Security check
  IF NOT public.is_company_owner(p_company_id) THEN
    RAISE EXCEPTION 'Not authorized. Only owners can generate invite codes.';
  END IF;

  IF p_role NOT IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern') THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  v_code := upper(substring(md5(random()::text) from 1 for 6));

  INSERT INTO public.company_invites (company_id, code, role, expires_at)
  VALUES (p_company_id, v_code, p_role, now() + interval '30 days')
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'id', v_invite.id,
    'code', v_invite.code,
    'company_id', v_invite.company_id,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join by Invite
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

  -- Find valid invite
  SELECT * INTO v_invite
  FROM public.company_invites
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_invite.company_id;

  -- Upsert membership
  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN json_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'currency', v_company.currency,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_company_by_invite(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_invite(uuid, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
