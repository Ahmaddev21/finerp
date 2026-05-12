/**
 * FinERP — Create tables via Supabase service role
 * Uses the built-in sql() method from supabase-js v2
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gcfzcdxsldhotitwijjg.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnpjZHhzbGRob3RpdHdpampnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwODU3NiwiZXhwIjoyMDkxMDg0NTc2fQ.Vkwy8thQjKqP0KBOBcXMI7Y6SuxewHa1-35fLJi9NHU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
  db:   { schema: 'public' },
});

// Check if supabase-js v2 sql() is available
async function trySQL(query) {
  // Method 1: supabase.sql tagged template (v2.44+)
  if (typeof supabase.sql === 'function') {
    try {
      const r = await supabase.sql`${query}`;
      return { ok: !r.error, data: r.data, error: r.error };
    } catch(e) {
      return { ok: false, error: e };
    }
  }
  return { ok: false, error: 'sql() not available' };
}

// Seed via REST (anon-compatible, works without DDL)
async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows).select();
  if (error && error.code !== '23505') { // ignore duplicate key
    console.log(`  ⚠️  ${table}: ${error.message}`);
    return false;
  }
  return true;
}

// upsert won't fail on conflicts
async function upsert(table, rows, onConflict) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) {
    console.log(`  ⚠️  ${table}: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('\n🚀 FinERP Database Setup\n');

  // Check what version of supabase-js we have
  console.log('supabase.sql available:', typeof supabase.sql);

  // Try DDL via sql()
  if (typeof supabase.sql === 'function') {
    console.log('\nRunning DDL via supabase.sql()...');
    const ddlResult = await trySQL(
      `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, client_name TEXT, status TEXT DEFAULT 'Planning', revenue NUMERIC DEFAULT 0, expenses NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`
    );
    console.log('DDL test:', ddlResult);
  }

  // Check which tables exist
  console.log('\nChecking existing tables...');
  const tables = ['projects','transactions','contracts','deliveries','engagements','tasks','audit_logs'];
  const status = {};
  for (const t of tables) {
    const { error } = await supabase.from(t).select('count').limit(0);
    status[t] = !error;
    console.log(`  ${status[t] ? '✅' : '❌'} ${t}${error ? ' — ' + error.message.slice(0,60) : ''}`);
  }

  const allExist = Object.values(status).every(Boolean);

  if (!allExist) {
    console.log('\n❌ Some tables are missing. Cannot seed yet.');
    console.log('\nRequired manual step:');
    console.log('→ Go to: https://supabase.com/dashboard/project/gcfzcdxsldhotitwijjg/sql/new');
    console.log('→ Paste contents of schema.sql and click Run');
    console.log('\nAlternatively, you can enable the pg_net extension or use the Supabase CLI.\n');
    process.exit(1);
  }

  // Seed all tables
  console.log('\nSeeding data...');

  const ok1 = await upsert('projects', [
    { id:'PRJ-001', name:'Snoonu Logistics Fleet',   client_name:'Snoonu',       status:'Active',    revenue:450000, expenses:320000 },
    { id:'PRJ-002', name:'TechCorp Infrastructure',  client_name:'TechCorp Inc.',status:'Active',    revenue:120000, expenses: 45000 },
    { id:'PRJ-003', name:'City Delivery Expansion',  client_name:'Urban Eats',   status:'Planning',  revenue: 85000, expenses: 12000 },
    { id:'PRJ-004', name:'Retail Supply Chain Audit',client_name:'MegaMart',     status:'Completed', revenue: 65000, expenses: 22000 },
    { id:'PRJ-005', name:'Q3 Rider Contracting',     client_name:'Snoonu',       status:'Active',    revenue:280000, expenses:210000 },
    { id:'PRJ-006', name:'Warehouse Optimization',   client_name:'LogisTech',    status:'On Hold',   revenue: 95000, expenses: 40000 },
  ], 'id');
  console.log(`  ${ok1?'✅':'❌'} projects`);

  const ok2 = await insert('transactions', [
    { date:'2026-04-05', type:'Invoice',    description:'Q1 Rider Supply',              project:'Snoonu Logistics', amount: 25000, status:'Paid'      },
    { date:'2026-04-04', type:'Expense',    description:'Server Hosting',               project:'Internal',         amount: -1200, status:'Completed' },
    { date:'2026-04-02', type:'Receipt',    description:'Payment for INV-001',          project:'Snoonu Logistics', amount: 25000, status:'Completed' },
    { date:'2026-04-01', type:'Petty Cash', description:'Office Supplies',              project:'Internal',         amount:  -150, status:'Completed' },
    { date:'2026-03-28', type:'Invoice',    description:'Consultation Services',        project:'TechCorp',         amount:  8500, status:'Pending'   },
    { date:'2026-03-25', type:'Expense',    description:'Fleet Maintenance',            project:'PRJ-001',          amount: -3200, status:'Completed' },
    { date:'2026-03-20', type:'Invoice',    description:'Urban Eats Delivery Retainer', project:'Urban Eats',      amount: 12000, status:'Paid'      },
    { date:'2026-03-18', type:'Receipt',    description:'Payment for INV-002',          project:'TechCorp',         amount:  8500, status:'Completed' },
  ]);
  console.log(`  ${ok2?'✅':'❌'} transactions`);

  const ok3 = await upsert('contracts', [
    { id:'CTR-001', title:'Snoonu Fleet Management Agreement', client:'Snoonu',       value:450000, start_date:'2026-01-01', end_date:'2026-12-31', status:'Active'            },
    { id:'CTR-002', title:'TechCorp Infrastructure SLA',       client:'TechCorp Inc.',value:120000, start_date:'2026-02-15', end_date:'2026-08-14', status:'Expiring Soon'     },
    { id:'CTR-003', title:'Urban Eats Delivery Expansion',     client:'Urban Eats',   value: 85000, start_date:'2026-04-01', end_date:'2026-09-30', status:'Pending Signature' },
    { id:'CTR-004', title:'MegaMart Supply Chain Audit',       client:'MegaMart',     value: 65000, start_date:'2025-07-01', end_date:'2025-12-31', status:'Expired'           },
    { id:'CTR-005', title:'Q3 Rider Contracting Block',        client:'Snoonu',       value:280000, start_date:'2026-03-01', end_date:'2026-09-30', status:'Active'            },
    { id:'CTR-006', title:'LogisTech Warehouse SLA',           client:'LogisTech',    value: 95000, start_date:'2026-04-10', end_date:'2026-10-09', status:'Pending Signature' },
  ], 'id');
  console.log(`  ${ok3?'✅':'❌'} contracts`);

  const ok4 = await upsert('deliveries', [
    { id:'DEL-001', description:'Q2 Rider Equipment Batch',    project:'PRJ-001', origin:'Warehouse A, Doha',  destination:'Snoonu HQ',         scheduled_date:'2026-04-09', status:'In Transit',    driver:'Mohammed A.' },
    { id:'DEL-002', description:'Server Hardware Delivery',    project:'PRJ-002', origin:'Tech Port, Doha',    destination:'TechCorp Office',   scheduled_date:'2026-04-10', status:'Scheduled',     driver:'Khalid R.'   },
    { id:'DEL-003', description:'Food Delivery Fleet Vehicles',project:'PRJ-003', origin:'Fleet Depot',        destination:'Urban Eats Hub',    scheduled_date:'2026-04-08', status:'Delivered',     driver:'Ahmed S.'    },
    { id:'DEL-004', description:'Retail Stock Transfer',       project:'PRJ-004', origin:'MegaMart Warehouse', destination:'Branch 12',         scheduled_date:'2026-04-07', status:'Issue Reported',driver:'Sultan M.'   },
    { id:'DEL-005', description:'Rider Gear Supply',           project:'PRJ-005', origin:'Warehouse B',        destination:'Snoonu HQ',         scheduled_date:'2026-04-11', status:'Scheduled',     driver:'Jassim K.'   },
    { id:'DEL-006', description:'Warehouse Racking Units',     project:'PRJ-006', origin:'Port Hamad',         destination:'LogisTech Facility',scheduled_date:'2026-04-15', status:'Scheduled',     driver:'Ali H.'      },
  ], 'id');
  console.log(`  ${ok4?'✅':'❌'} deliveries`);

  const ok5 = await upsert('engagements', [
    { id:'CON-001', client:'TechCorp Inc.', consultant:'Super Admin', service:'IT Infrastructure Strategy',   hourly_rate:450, hours_billed:42, start_date:'2026-02-01', status:'Active'    },
    { id:'CON-002', client:'Snoonu',        consultant:'Admin User',  service:'Operations Optimization',      hourly_rate:380, hours_billed:38, start_date:'2026-03-10', status:'Active'    },
    { id:'CON-003', client:'MegaMart',      consultant:'Super Admin', service:'Supply Chain Audit Consulting',hourly_rate:420, hours_billed:44, start_date:'2025-11-01', status:'Completed' },
    { id:'CON-004', client:'Urban Eats',    consultant:'Admin User',  service:'Delivery Fleet Advisory',      hourly_rate:350, hours_billed: 0, start_date:'2026-04-01', status:'On Hold'   },
    { id:'CON-005', client:'LogisTech',     consultant:'Super Admin', service:'Warehouse Process Design',     hourly_rate:400, hours_billed: 0, start_date:'2026-04-08', status:'On Hold'   },
  ], 'id');
  console.log(`  ${ok5?'✅':'❌'} engagements`);

  const ok6 = await upsert('tasks', [
    { id:'TSK-001', title:'Review Q2 contract renewals',              project:'PRJ-001', assignee:'Admin User', priority:'High',  status:'in_progress', due_date:'2026-04-15' },
    { id:'TSK-002', title:'Follow up on pending invoices',            project:'PRJ-002', assignee:'BD User',    priority:'High',  status:'pending',     due_date:'2026-04-12' },
    { id:'TSK-003', title:'Update delivery fleet status',             project:'PRJ-001', assignee:'Admin User', priority:'Medium',status:'pending',     due_date:'2026-04-18' },
    { id:'TSK-004', title:'Prepare retail supply chain audit report', project:'PRJ-004', assignee:'Super Admin',priority:'Low',   status:'completed',   due_date:'2026-04-05' },
    { id:'TSK-005', title:'Coordinate warehouse optimization kickoff',project:'PRJ-006', assignee:'BD User',    priority:'Medium',status:'in_progress', due_date:'2026-04-20' },
    { id:'TSK-006', title:'Generate monthly financial summary',       project:'PRJ-003', assignee:'Admin User', priority:'High',  status:'pending',     due_date:'2026-04-10' },
  ], 'id');
  console.log(`  ${ok6?'✅':'❌'} tasks`);

  console.log('\n✅ Seeding complete! Verifying row counts...\n');
  for (const t of ['projects','transactions','contracts','deliveries','engagements','tasks']) {
    const { count } = await supabase.from(t).select('*', { count:'exact', head:true });
    console.log(`  ${t}: ${count} rows`);
  }
  console.log('\n🎉 Done! Reload http://localhost:3000/\n');
}

main().catch(console.error);
