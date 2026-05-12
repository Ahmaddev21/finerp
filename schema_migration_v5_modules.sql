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
