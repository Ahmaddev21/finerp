-- ═══════════════════════════════════════════════════════════════════
-- FinERP v2 Schema Migration — Multi-Tenant + Approval Workflow
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. PROFILES (linked to auth.users)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username   text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ─────────────────────────────────────────
-- 2. COMPANIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  currency   text DEFAULT 'QR',
  industry   text,
  join_code  text UNIQUE,
  user_id    uuid REFERENCES auth.users ON DELETE SET NULL, -- original creator
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Function to generate random 6-char join code
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────
-- 3. COMPANY_USERS (multi-tenant roles)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_users (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role       text CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern')) DEFAULT 'intern',
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────
-- 4. ADD company_id TO ALL TABLES
-- ─────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects', 'transactions', 'contracts',
    'deliveries', 'engagements', 'tasks', 'audit_logs'
  ]) LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies ON DELETE CASCADE',
      t
    );
  END LOOP;
END $$;


-- ─────────────────────────────────────────
-- 5. APPROVAL WORKFLOW COLUMNS on transactions
-- ─────────────────────────────────────────
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS attachment_url text;

-- Update status check constraint to support new workflow values
-- First drop the old constraint if it exists, then add the new one
DO $$ BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- We don't add a constraint here to keep it flexible
-- The app layer will enforce: draft, pending, approved, paid, completed, rejected, cancelled


-- ─────────────────────────────────────────
-- 6. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies ON DELETE CASCADE,
  type       text NOT NULL, -- 'overdue_invoice', 'pending_approval', 'task_assigned', 'contract_expiring'
  title      text NOT NULL,
  message    text,
  severity   text DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  link       text, -- relative URL to navigate to
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────
-- 7. HELPER FUNCTIONS
-- ─────────────────────────────────────────

-- Check if current user belongs to a specific company
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

-- Create Company (auto-add creator as owner + generate join code)
CREATE OR REPLACE FUNCTION public.create_company_with_admin(p_name text, p_currency text DEFAULT 'QR', p_user_id uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_company_id uuid;
  v_join_code text;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required for company creation';
  END IF;

  v_join_code := public.generate_join_code();

  INSERT INTO public.companies (user_id, name, currency, join_code)
  VALUES (v_user_id, p_name, p_currency, v_join_code)
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner');

  RETURN json_build_object(
    'id', v_company_id,
    'name', p_name,
    'currency', p_currency,
    'join_code', v_join_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join Company by invite code
CREATE OR REPLACE FUNCTION public.join_company_by_code(p_code text)
RETURNS json AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_currency text;
BEGIN
  SELECT id, name, currency INTO v_company_id, v_company_name, v_currency
  FROM public.companies
  WHERE join_code = p_code;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_company_id, auth.uid(), 'intern')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'id', v_company_id,
    'name', v_company_name,
    'currency', v_currency
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regenerate join code (admin only, enforced at app level)
CREATE OR REPLACE FUNCTION public.regenerate_join_code(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_new_code text;
BEGIN
  v_new_code := public.generate_join_code();
  UPDATE public.companies SET join_code = v_new_code WHERE id = p_company_id;
  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────
-- 8. ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────

-- Profiles: users can see all profiles, edit only their own
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Company: members can view their company
DROP POLICY IF EXISTS "Company members can view company" ON public.companies;
CREATE POLICY "Company members can view company"
  ON public.companies FOR SELECT
  USING (id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

-- Company Users: members can see all members of their company
DROP POLICY IF EXISTS "Users can view members of their company" ON public.company_users;
CREATE POLICY "Users can view members of their company"
  ON public.company_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- Macro: Apply company-scoped RLS to all financial tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects', 'transactions', 'contracts',
    'deliveries', 'engagements', 'tasks'
  ]) LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT
    EXECUTE format(
      'DROP POLICY IF EXISTS "Company members can view %1$s" ON public.%1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Company members can view %1$s" ON public.%1$I FOR SELECT USING (public.is_company_member(company_id))', t
    );

    -- INSERT
    EXECUTE format(
      'DROP POLICY IF EXISTS "Company members can insert %1$s" ON public.%1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Company members can insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.is_company_member(company_id))', t
    );

    -- UPDATE
    EXECUTE format(
      'DROP POLICY IF EXISTS "Company members can update %1$s" ON public.%1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Company members can update %1$s" ON public.%1$I FOR UPDATE USING (public.is_company_member(company_id))', t
    );

    -- DELETE
    EXECUTE format(
      'DROP POLICY IF EXISTS "Company members can delete %1$s" ON public.%1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Company members can delete %1$s" ON public.%1$I FOR DELETE USING (public.is_company_member(company_id))', t
    );
  END LOOP;
END $$;

-- Notifications: users can only see their own
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Audit logs: company-scoped read-only for users (writes via trigger only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view audit logs" ON public.audit_logs;
CREATE POLICY "Company members can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_company_member(company_id));


-- ─────────────────────────────────────────
-- 9. AUDIT TRIGGER (enhanced with company_id)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS trigger AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_company_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_old_data := null;
    v_new_data := to_jsonb(NEW);
    v_company_id := NEW.company_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_company_id := NEW.company_id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := null;
    v_company_id := OLD.company_id;
  END IF;

  INSERT INTO public.audit_logs (user_email, action, table_name, record_id, details, company_id)
  VALUES (
    COALESCE(auth.email(), 'system'),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Created new ' || TG_TABLE_NAME || ' record'
      WHEN TG_OP = 'UPDATE' THEN 'Updated ' || TG_TABLE_NAME || ' record'
      WHEN TG_OP = 'DELETE' THEN 'Deleted ' || TG_TABLE_NAME || ' record'
    END,
    v_company_id
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to financial tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects', 'transactions', 'contracts',
    'deliveries', 'engagements', 'tasks'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_log_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_log_%1$s
       AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
       FOR EACH ROW EXECUTE PROCEDURE public.log_financial_change()', t
    );
  END LOOP;
END $$;


-- ─────────────────────────────────────────
-- 10. ENABLE REALTIME for key tables
-- ─────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- 11. USER ACTIVITY TRACKING (for Live Dashboard)
-- ─────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away'));

-- Update last login on session start (handled in app, but we can track active state)
CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = now(),
      status = 'online'
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for profiles to support "Live" dashboard
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- 12. ROLE EXPANSION & MIGRATION
-- ─────────────────────────────────────────

-- Role Migration (for existing data) — Run this BEFORE constraints to prevent failures
UPDATE public.company_users SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_users SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_users SET role = 'bdm' WHERE role = 'bd';
UPDATE public.company_users SET role = 'intern' WHERE role = 'member';

UPDATE public.company_invites SET role = 'owner' WHERE role = 'super_admin';
UPDATE public.company_invites SET role = 'admin' WHERE role = 'moderator';
UPDATE public.company_invites SET role = 'bdm' WHERE role = 'bd';
UPDATE public.company_invites SET role = 'intern' WHERE role = 'member';

-- Update constraints
ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check 
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_role_check;
ALTER TABLE public.company_invites ADD CONSTRAINT company_invites_role_check
  CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern'));

-- Change Requests Table
CREATE TABLE IF NOT EXISTS public.change_requests (
  id           bigserial PRIMARY KEY,
  company_id   uuid REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  record_type  text NOT NULL, -- 'transaction'
  record_id    text NOT NULL,
  requested_by uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  status       text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  old_data     jsonb,
  new_data     jsonb,
  reason       text,
  reviewed_by  uuid REFERENCES auth.users ON DELETE SET NULL,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Change Request Policies
DROP POLICY IF EXISTS "Members can view change requests" ON public.change_requests;
CREATE POLICY "Members can view change requests"
  ON public.change_requests FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can insert change requests" ON public.change_requests;
CREATE POLICY "Members can insert change requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can update change requests" ON public.change_requests;
CREATE POLICY "Admins can update change requests"
  ON public.change_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = change_requests.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('owner', 'admin')
    )
  );

-- Company Invites Table (Role-specific)
CREATE TABLE IF NOT EXISTS public.company_invites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  code       text UNIQUE NOT NULL,
  role       text NOT NULL CHECK (role IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage invites" ON public.company_invites;
CREATE POLICY "Owners can manage invites"
  ON public.company_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_invites.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Anyone can view invite by code" ON public.company_invites;
CREATE POLICY "Anyone can view invite by code"
  ON public.company_invites FOR SELECT
  USING (true);

-- Enable Realtime for change_requests
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE change_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 13. FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────

-- Invite Code Generation
CREATE OR REPLACE FUNCTION generate_company_invite(p_company_id uuid, p_role text)
RETURNS json AS $$
DECLARE
  v_code text;
  v_count integer;
  v_invite record;
BEGIN
  IF p_role NOT IN ('owner', 'admin', 'bdm', 'engineer', 'receptionist', 'developer', 'intern') THEN
    RAISE EXCEPTION 'Invalid invite role';
  END IF;

  SELECT count(*) INTO v_count FROM public.company_users
  WHERE company_id = p_company_id AND user_id = auth.uid() AND role = 'owner';
    
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Not authorized to generate invites. Only owners can manage access codes.';
  END IF;

  v_code := upper(substring(md5(random()::text) from 1 for 6));

  INSERT INTO public.company_invites (company_id, code, role)
  VALUES (p_company_id, v_code, p_role)
  RETURNING * INTO v_invite;

  RETURN json_build_object('code', v_invite.code, 'company_id', v_invite.company_id, 'role', v_invite.role, 'expires_at', v_invite.expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction Modification Enforcement
CREATE OR REPLACE FUNCTION enforce_transaction_mod_rules() RETURNS trigger AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() != 'authenticated' THEN RETURN NEW; END IF;

    SELECT role INTO v_role FROM public.company_users
    WHERE company_id = NEW.company_id AND user_id = auth.uid();

    IF v_role IN ('owner', 'admin', 'developer') THEN RETURN NEW; END IF;

    IF v_role IN ('intern', 'receptionist', 'engineer') THEN
        RAISE EXCEPTION 'Access Denied: Your role does not have permission to modify transaction data.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_mod ON public.transactions;
CREATE TRIGGER on_transaction_mod
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION enforce_transaction_mod_rules();

-- Reload Cache
NOTIFY pgrst, 'reload schema';
