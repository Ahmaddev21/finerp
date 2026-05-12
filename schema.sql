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
