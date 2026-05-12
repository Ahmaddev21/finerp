-- FinERP Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
create table if not exists projects (
  id          text primary key,
  name        text not null,
  client_name text not null,
  status      text default 'Planning'
                check (status in ('Active','Planning','Completed','On Hold')),
  revenue     numeric(14,2) default 0,
  expenses    numeric(14,2) default 0,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- TRANSACTIONS (Accounting)
-- ─────────────────────────────────────────
create table if not exists transactions (
  id          bigserial primary key,
  date        date not null default current_date,
  type        text not null,
  description text not null,
  project     text default 'Internal',
  amount      numeric(14,2) not null,
  status      text default 'Pending',
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- CONTRACTS (ERP > Contracting)
-- ─────────────────────────────────────────
create table if not exists contracts (
  id         text primary key,
  title      text not null,
  client     text not null,
  value      numeric(14,2) default 0,
  start_date date,
  end_date   date,
  status     text default 'Pending Signature'
               check (status in ('Active','Pending Signature','Expiring Soon','Expired')),
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- DELIVERIES (ERP > Delivery)
-- ─────────────────────────────────────────
create table if not exists deliveries (
  id             text primary key,
  description    text not null,
  project        text,
  origin         text default '—',
  destination    text default '—',
  scheduled_date text default '—',
  status         text default 'Scheduled'
                   check (status in ('In Transit','Scheduled','Delivered','Issue Reported')),
  driver         text default 'Unassigned',
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- ENGAGEMENTS (ERP > Consultation)
-- ─────────────────────────────────────────
create table if not exists engagements (
  id          text primary key,
  client      text not null,
  consultant  text,
  service     text not null,
  hourly_rate numeric(10,2) default 0,
  hours_billed numeric(10,2) default 0,
  start_date  date,
  status      text default 'Active'
                check (status in ('Active','Completed','On Hold')),
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- TASKS (Kanban)
-- ─────────────────────────────────────────
create table if not exists tasks (
  id         text primary key,
  title      text not null,
  project    text,
  assignee   text,
  priority   text default 'Medium'
               check (priority in ('High','Medium','Low')),
  status     text default 'pending'
               check (status in ('pending','in_progress','completed')),
  due_date   text default '—',
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────
create table if not exists audit_logs (
  id         bigserial primary key,
  user_email text not null,
  action     text not null
               check (action in ('CREATE','UPDATE','DELETE')),
  table_name text not null,
  record_id  text,
  details    text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- ENABLE REALTIME for audit_logs
-- ─────────────────────────────────────────
alter publication supabase_realtime add table audit_logs;

-- ─────────────────────────────────────────
-- SEED DATA (Demo)
-- ─────────────────────────────────────────
insert into projects (id, name, client_name, status, revenue, expenses) values
  ('PRJ-001', 'Snoonu Logistics Fleet',   'Snoonu',       'Active',    450000, 320000),
  ('PRJ-002', 'TechCorp Infrastructure',  'TechCorp Inc.','Active',    120000,  45000),
  ('PRJ-003', 'City Delivery Expansion',  'Urban Eats',   'Planning',   85000,  12000),
  ('PRJ-004', 'Retail Supply Chain Audit','MegaMart',     'Completed',  65000,  22000),
  ('PRJ-005', 'Q3 Rider Contracting',     'Snoonu',       'Active',    280000, 210000),
  ('PRJ-006', 'Warehouse Optimization',   'LogisTech',    'On Hold',    95000,  40000)
on conflict (id) do nothing;

insert into transactions (date, type, description, project, amount, status) values
  ('2026-04-05','Invoice',   'Q1 Rider Supply',             'Snoonu Logistics', 25000,  'Paid'),
  ('2026-04-04','Expense',   'Server Hosting',              'Internal',          -1200, 'Completed'),
  ('2026-04-02','Receipt',   'Payment for INV-001',         'Snoonu Logistics', 25000,  'Completed'),
  ('2026-04-01','Petty Cash','Office Supplies',             'Internal',            -150,'Completed'),
  ('2026-03-28','Invoice',   'Consultation Services',       'TechCorp',          8500,  'Pending'),
  ('2026-03-25','Expense',   'Fleet Maintenance',           'PRJ-001',           -3200, 'Completed'),
  ('2026-03-20','Invoice',   'Urban Eats Delivery Retainer','Urban Eats',       12000,  'Paid'),
  ('2026-03-18','Receipt',   'Payment for INV-002',         'TechCorp',          8500,  'Completed')
on conflict do nothing;

insert into contracts (id, title, client, value, start_date, end_date, status) values
  ('CTR-001','Snoonu Fleet Management Agreement', 'Snoonu',       450000,'2026-01-01','2026-12-31','Active'),
  ('CTR-002','TechCorp Infrastructure SLA',       'TechCorp Inc.',120000,'2026-02-15','2026-08-14','Expiring Soon'),
  ('CTR-003','Urban Eats Delivery Expansion',     'Urban Eats',    85000,'2026-04-01','2026-09-30','Pending Signature'),
  ('CTR-004','MegaMart Supply Chain Audit',       'MegaMart',      65000,'2025-07-01','2025-12-31','Expired'),
  ('CTR-005','Q3 Rider Contracting Block',        'Snoonu',       280000,'2026-03-01','2026-09-30','Active'),
  ('CTR-006','LogisTech Warehouse SLA',           'LogisTech',     95000,'2026-04-10','2026-10-09','Pending Signature')
on conflict (id) do nothing;

insert into deliveries (id, description, project, origin, destination, scheduled_date, status, driver) values
  ('DEL-001','Q2 Rider Equipment Batch',  'PRJ-001','Warehouse A, Doha','Snoonu HQ',       '2026-04-09','In Transit',    'Mohammed A.'),
  ('DEL-002','Server Hardware Delivery',  'PRJ-002','Tech Port, Doha',  'TechCorp Office', '2026-04-10','Scheduled',     'Khalid R.'),
  ('DEL-003','Food Delivery Fleet Vehicles','PRJ-003','Fleet Depot',    'Urban Eats Hub',  '2026-04-08','Delivered',     'Ahmed S.'),
  ('DEL-004','Retail Stock Transfer',     'PRJ-004','MegaMart Warehouse','Branch 12',      '2026-04-07','Issue Reported','Sultan M.'),
  ('DEL-005','Rider Gear Supply',         'PRJ-005','Warehouse B',      'Snoonu HQ',       '2026-04-11','Scheduled',     'Jassim K.'),
  ('DEL-006','Warehouse Racking Units',   'PRJ-006','Port Hamad',       'LogisTech Facility','2026-04-15','Scheduled',  'Ali H.')
on conflict (id) do nothing;

insert into engagements (id, client, consultant, service, hourly_rate, hours_billed, start_date, status) values
  ('CON-001','TechCorp Inc.','Super Admin','IT Infrastructure Strategy', 450, 42,'2026-02-01','Active'),
  ('CON-002','Snoonu',       'Admin User', 'Operations Optimization',    380, 38,'2026-03-10','Active'),
  ('CON-003','MegaMart',     'Super Admin','Supply Chain Audit Consulting',420,44,'2025-11-01','Completed'),
  ('CON-004','Urban Eats',   'Admin User', 'Delivery Fleet Advisory',    350,  0,'2026-04-01','On Hold'),
  ('CON-005','LogisTech',    'Super Admin','Warehouse Process Design',   400,  0,'2026-04-08','On Hold')
on conflict (id) do nothing;

insert into tasks (id, title, project, assignee, priority, status, due_date) values
  ('TSK-001','Review Q2 contract renewals',             'PRJ-001','Admin User', 'High',  'in_progress','2026-04-15'),
  ('TSK-002','Follow up on pending invoices',           'PRJ-002','BD User',    'High',  'pending',    '2026-04-12'),
  ('TSK-003','Update delivery fleet status',            'PRJ-001','Admin User', 'Medium','pending',    '2026-04-18'),
  ('TSK-004','Prepare retail supply chain audit report','PRJ-004','Super Admin','Low',   'completed',  '2026-04-05'),
  ('TSK-005','Coordinate warehouse optimization kickoff','PRJ-006','BD User',   'Medium','in_progress','2026-04-20'),
  ('TSK-006','Generate monthly financial summary',      'PRJ-003','Admin User', 'High',  'pending',    '2026-04-10')
on conflict (id) do nothing;
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
  role       text CHECK (role IN ('super_admin', 'admin', 'member')) DEFAULT 'member',
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

-- Create Company (auto-add creator as super_admin + generate join code)
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
  VALUES (v_company_id, v_user_id, 'super_admin');

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
  VALUES (v_company_id, auth.uid(), 'member')
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
    user_id = auth.uid() OR -- Base case: users can always see their own role/membership
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage users" ON public.company_users;
CREATE POLICY "Owners can manage users"
  ON public.company_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'super_admin'
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
-- 12. ROLE EXPANSION & CHANGE REQUESTS
-- ─────────────────────────────────────────

-- Update company_users role constraint
DO $$ BEGIN
  ALTER TABLE public.company_users DROP CONSTRAINT IF EXISTS company_users_role_check;
  ALTER TABLE public.company_users ADD CONSTRAINT company_users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'moderator', 'bdm', 'member'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
      AND cu.role IN ('super_admin', 'admin')
    )
  );

-- Company Invites Table (Role-specific)
CREATE TABLE IF NOT EXISTS public.company_invites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  code       text UNIQUE NOT NULL,
  role       text NOT NULL CHECK (role IN ('moderator', 'bdm', 'member')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage invites" ON public.company_invites;
CREATE POLICY "Admins can manage invites"
  ON public.company_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_invites.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('super_admin', 'admin')
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
-- FinERP v4 - Hardening & Bypass Prevention
-- Run after `schema_migration_v3_roles.sql`

-- 1. Create a function to enforce "Moderator Restriction" at the database level
CREATE OR REPLACE FUNCTION public.enforce_transaction_mod_rules()
RETURNS trigger AS $$
DECLARE
    v_role text;
BEGIN
    -- Only check if the user is authenticated (not a system/service role)
    IF auth.role() != 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Get the current user's role in this company
    SELECT role INTO v_role
    FROM public.company_users
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND user_id = auth.uid()
    LIMIT 1;

    -- RULES FOR MODERATORS
    IF v_role = 'moderator' THEN
        -- Rule A: Prevent Deletion
        IF (TG_OP = 'DELETE') THEN
            RAISE EXCEPTION 'Moderators are not permitted to delete transactions. Please contact an Administrator.';
        END IF;

        -- Rule B: Prevent direct modification of sensitive financial fields
        IF (TG_OP = 'UPDATE') THEN
            IF (
                NEW.amount IS DISTINCT FROM OLD.amount OR
                NEW.date IS DISTINCT FROM OLD.date OR
                NEW.type IS DISTINCT FROM OLD.type OR
                NEW.project IS DISTINCT FROM OLD.project
            ) THEN
                RAISE EXCEPTION 'Sensitive field modification blocked for Moderators. Please submit a Change Request for approval.';
            END IF;
        END IF;
    END IF;

    -- RULES FOR BDM/MEMBER/BD (Even stricter)
    IF v_role IN ('bdm', 'member', 'bd') THEN
         IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
             -- Only allow updates to their own metadata if absolutely necessary, 
             -- but for now, block all financial edits for these low-privilege roles.
             RAISE EXCEPTION 'Access Denied: Your role does not have permission to modify transaction data.';
         END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply the trigger
DROP TRIGGER IF EXISTS trg_enforce_transaction_mod_rules ON public.transactions;
CREATE TRIGGER trg_enforce_transaction_mod_rules
    BEFORE UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_transaction_mod_rules();

-- 3. Document the hardening in the audit system
COMMENT ON TRIGGER trg_enforce_transaction_mod_rules ON public.transactions IS 'Enforces bypass-proof restrictions on Moderator/Member roles for financial integrity.';
-- ═══════════════════════════════════════════════════════════════════
-- FinERP v5 Schema Migration — Contracting & Consultancy Modules
-- Run after `schema_migration_v4_hardening.sql`
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- CONTRACTING MODULE
-- ─────────────────────────────────────────

-- 1. Contracting Projects
CREATE TABLE IF NOT EXISTS public.contracting_projects (
  id           text PRIMARY KEY,
  contract_id  text REFERENCES public.contracts(id) ON DELETE SET NULL,
  name         text NOT NULL,
  client       text NOT NULL,
  value        numeric(14,2) DEFAULT 0,
  status       text DEFAULT 'Active'
                 CHECK (status IN ('Active','Planning','Completed','On Hold')),
  start_date   date,
  end_date     date,
  description  text,
  company_id   uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 2. Contracting Subcontractors
CREATE TABLE IF NOT EXISTS public.contracting_subcontractors (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  company_details text,
  status          text DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. Contracting Quotations
CREATE TABLE IF NOT EXISTS public.contracting_quotations (
  id           text PRIMARY KEY,
  project_id   text REFERENCES public.contracting_projects(id) ON DELETE SET NULL,
  client       text NOT NULL,
  description  text NOT NULL,
  amount       numeric(14,2) DEFAULT 0,
  status       text DEFAULT 'draft'
                 CHECK (status IN ('draft','pending','approved','rejected')),
  valid_until  date,
  notes        text,
  company_id   uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 4. Contracting Invoices Out (to clients — revenue)
CREATE TABLE IF NOT EXISTS public.contracting_invoices_out (
  id              text PRIMARY KEY,
  project_id      text REFERENCES public.contracting_projects(id) ON DELETE SET NULL,
  invoice_number  text NOT NULL,
  client          text NOT NULL,
  description     text,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  status          text DEFAULT 'draft'
                    CHECK (status IN ('draft','pending','approved','paid')),
  issued_date     date DEFAULT current_date,
  due_date        date,
  transaction_id  bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 5. Contracting Invoices In (from subcontractors — cost)
CREATE TABLE IF NOT EXISTS public.contracting_invoices_in (
  id                text PRIMARY KEY,
  project_id        text REFERENCES public.contracting_projects(id) ON DELETE SET NULL,
  subcontractor_id  text REFERENCES public.contracting_subcontractors(id) ON DELETE SET NULL,
  subcontractor     text NOT NULL,
  invoice_ref       text,
  description       text,
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  status            text DEFAULT 'draft'
                      CHECK (status IN ('draft','pending','approved','paid')),
  received_date     date DEFAULT current_date,
  due_date          date,
  transaction_id    bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id        uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 6. Contracting Payments (incoming from clients & outgoing to subcontractors)
CREATE TABLE IF NOT EXISTS public.contracting_payments (
  id              text PRIMARY KEY,
  project_id      text REFERENCES public.contracting_projects(id) ON DELETE SET NULL,
  invoice_id      text,  -- references either invoices_out or invoices_in
  direction       text NOT NULL CHECK (direction IN ('in','out')),
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  payment_date    date DEFAULT current_date,
  method          text DEFAULT 'Bank Transfer',
  reference       text,
  notes           text,
  status          text DEFAULT 'completed'
                    CHECK (status IN ('pending','completed','failed')),
  transaction_id  bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────
-- CONSULTANCY MODULE
-- ─────────────────────────────────────────

-- 7. Consultancy Partners (European)
CREATE TABLE IF NOT EXISTS public.consultancy_partners (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  country         text,
  contact_person  text,
  contact_email   text,
  contact_phone   text,
  status          text DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  notes           text,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 8. Consultancy Clients
CREATE TABLE IF NOT EXISTS public.consultancy_clients (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  country         text,
  contact_person  text,
  contact_email   text,
  contact_phone   text,
  industry        text,
  status          text DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  notes           text,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 9. Consultancy Invoices In (from European partners — costs, multi-currency)
CREATE TABLE IF NOT EXISTS public.consultancy_invoices_in (
  id                text PRIMARY KEY,
  partner_id        text REFERENCES public.consultancy_partners(id) ON DELETE SET NULL,
  project_id        text,  -- free text link to project name
  invoice_ref       text,
  description       text,
  currency          text DEFAULT 'QR' CHECK (currency IN ('QR','EUR','USD','GBP')),
  original_amount   numeric(14,2) NOT NULL DEFAULT 0,
  exchange_rate     numeric(10,4) DEFAULT 1.0,
  converted_amount  numeric(14,2) NOT NULL DEFAULT 0,  -- always in QR
  status            text DEFAULT 'draft'
                      CHECK (status IN ('draft','pending','approved','paid')),
  received_date     date DEFAULT current_date,
  due_date          date,
  transaction_id    bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id        uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 10. Consultancy Invoices Out (to clients — revenue)
CREATE TABLE IF NOT EXISTS public.consultancy_invoices_out (
  id              text PRIMARY KEY,
  client_id       text REFERENCES public.consultancy_clients(id) ON DELETE SET NULL,
  project_id      text,  -- free text link to project name
  invoice_number  text NOT NULL,
  client          text NOT NULL,
  description     text,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  status          text DEFAULT 'draft'
                    CHECK (status IN ('draft','pending','approved','paid')),
  issued_date     date DEFAULT current_date,
  due_date        date,
  transaction_id  bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 11. Consultancy Payments (from clients)
CREATE TABLE IF NOT EXISTS public.consultancy_payments (
  id              text PRIMARY KEY,
  invoice_id      text REFERENCES public.consultancy_invoices_out(id) ON DELETE SET NULL,
  client_id       text REFERENCES public.consultancy_clients(id) ON DELETE SET NULL,
  client          text NOT NULL,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  payment_date    date DEFAULT current_date,
  method          text DEFAULT 'Bank Transfer',
  reference       text,
  notes           text,
  status          text DEFAULT 'completed'
                    CHECK (status IN ('pending','completed','failed')),
  transaction_id  bigint REFERENCES public.transactions(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES public.companies ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────
-- ENABLE RLS ON ALL NEW TABLES
-- ─────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contracting_projects', 'contracting_subcontractors', 'contracting_quotations',
    'contracting_invoices_out', 'contracting_invoices_in', 'contracting_payments',
    'consultancy_partners', 'consultancy_clients',
    'consultancy_invoices_in', 'consultancy_invoices_out', 'consultancy_payments'
  ]) LOOP
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


-- ─────────────────────────────────────────
-- AUDIT TRIGGERS ON ALL NEW TABLES
-- ─────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contracting_projects', 'contracting_subcontractors', 'contracting_quotations',
    'contracting_invoices_out', 'contracting_invoices_in', 'contracting_payments',
    'consultancy_partners', 'consultancy_clients',
    'consultancy_invoices_in', 'consultancy_invoices_out', 'consultancy_payments'
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
-- ENABLE REALTIME ON KEY TABLES
-- ─────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contracting_projects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contracting_invoices_out; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contracting_invoices_in; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contracting_payments; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE consultancy_invoices_in; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE consultancy_invoices_out; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE consultancy_payments; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ─────────────────────────────────────────
-- USEFUL INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ctr_proj_company ON public.contracting_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_ctr_proj_status ON public.contracting_projects(status);
CREATE INDEX IF NOT EXISTS idx_ctr_quot_project ON public.contracting_quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_ctr_inv_out_project ON public.contracting_invoices_out(project_id);
CREATE INDEX IF NOT EXISTS idx_ctr_inv_in_project ON public.contracting_invoices_in(project_id);
CREATE INDEX IF NOT EXISTS idx_ctr_pay_project ON public.contracting_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_ctr_sub_company ON public.contracting_subcontractors(company_id);
CREATE INDEX IF NOT EXISTS idx_con_partners_company ON public.consultancy_partners(company_id);
CREATE INDEX IF NOT EXISTS idx_con_clients_company ON public.consultancy_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_con_inv_in_partner ON public.consultancy_invoices_in(partner_id);
CREATE INDEX IF NOT EXISTS idx_con_inv_out_client ON public.consultancy_invoices_out(client_id);
CREATE INDEX IF NOT EXISTS idx_con_pay_invoice ON public.consultancy_payments(invoice_id);
-- Schema Migration V5: Production Enhancements
-- Soft Delete, Bank Reconciliation, and Period Locking

BEGIN;

--------------------------------------------------------------------------------
-- 1. ADD SOFT DELETE & RECONCILIATION FLAGS TO TRANSACTIONS
--------------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false;

-- Add index to improve query performance for active records
CREATE INDEX IF NOT EXISTS idx_transactions_is_deleted ON public.transactions(is_deleted) WHERE NOT is_deleted;

--------------------------------------------------------------------------------
-- 2. ADD PERIOD LOCK TO COMPANIES
--------------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS lock_date DATE;

--------------------------------------------------------------------------------
-- 3. UPDATE DB TRIGGERS: BLOCK MODIFICATIONS IN LOCKED PERIODS
--------------------------------------------------------------------------------
-- We will add a trigger that checks the company's lock_date against the transaction date

CREATE OR REPLACE FUNCTION public.check_transaction_lock()
RETURNS trigger AS $$
DECLARE
  v_lock_date DATE;
  v_transaction_date DATE;
  v_company_id UUID;
BEGIN
  -- Get the company_id and date depending on operation type
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
    v_transaction_date := OLD.date;
  ELSE
    v_company_id := NEW.company_id;
    v_transaction_date := NEW.date;
  END IF;

  -- Get the company's lock date
  SELECT lock_date INTO v_lock_date
  FROM public.companies
  WHERE id = v_company_id;

  -- If lock date exists and transaction belongs to locked period
  IF v_lock_date IS NOT NULL AND v_transaction_date <= v_lock_date THEN
    -- Prevent the action
    RAISE EXCEPTION 'This accounting period is locked (Lock Date: %). Modifications are not permitted.', v_lock_date;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger before INSERT, UPDATE, or DELETE on transactions
DROP TRIGGER IF EXISTS trg_enforce_period_lock ON public.transactions;
CREATE TRIGGER trg_enforce_period_lock
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transaction_lock();

--------------------------------------------------------------------------------
-- 4. UPDATE PERMISSIONS FOR NEW COLUMNS
--------------------------------------------------------------------------------

-- Ensure the new columns in connections/transactions are broadcasted safely via RLS
-- (They will inherit the existing RLS policies of the schema automatically)

COMMIT;
-- ═══════════════════════════════════════════════════════════════════
-- FinERP Storage Setup — Supabase Storage for Document Attachments
-- Run in: Supabase Dashboard → SQL Editor → AFTER schema_migration_v2.sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create the 'finance_attachments' bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'finance_attachments',
  'finance_attachments',
  false, -- Private bucket (authenticated only)
  false,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. Storage RLS Policies (company-scoped paths: {company_id}/{type}/{record_id}/{filename})

-- Drop existing policies safely
DO $$
BEGIN
  BEGIN DROP POLICY "finerp_upload" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "finerp_view" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "finerp_delete" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- INSERT: Users can upload to their company's folder
CREATE POLICY "finerp_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- SELECT: Users can view files in their company's folder
CREATE POLICY "finerp_view"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- DELETE: Users can delete files in their company's folder
CREATE POLICY "finerp_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);
