/**
 * Runtime diagnostic — checks live DB state for Consultation & Contracting
 * Usage: SUPABASE_PAT=YOUR_SUPABASE_PAT node diagnose-runtime.mjs
 */
const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) { console.error('SUPABASE_PAT required'); process.exit(1); }

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || JSON.stringify(body));
  return body;
}

const TABLES = [
  'contracts',
  'contracting_projects',
  'contracting_quotations',
  'contracting_subcontractors',
  'contracting_invoices_out',
  'contracting_invoices_in',
  'contracting_payments',
  'engagements',
  'consultancy_partners',
  'consultancy_clients',
  'consultancy_invoices_out',
  'consultancy_invoices_in',
  'consultancy_payments',
];

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  FinERP Runtime Diagnostic');
  console.log('══════════════════════════════════════════\n');

  // 1. Which tables actually exist?
  console.log('── 1. TABLE EXISTENCE ──────────────────────');
  const existsResult = await sql(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  const existingTables = new Set(existsResult.map(r => r.table_name));
  for (const t of TABLES) {
    const exists = existingTables.has(t);
    console.log(`  ${exists ? '✅' : '❌ MISSING'} ${t}`);
  }

  // 2. Column presence — does company_id exist on each table?
  console.log('\n── 2. company_id COLUMN PRESENCE ──────────');
  const colResult = await sql(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(ARRAY[${TABLES.map(t => `'${t}'`).join(',')}])
      AND column_name = 'company_id'
    ORDER BY table_name;
  `);
  const hasCompanyId = new Set(colResult.map(r => r.table_name));
  for (const t of TABLES) {
    if (!existingTables.has(t)) { console.log(`  ⚪ ${t} — table missing, skipped`); continue; }
    console.log(`  ${hasCompanyId.has(t) ? '✅' : '❌ NO company_id'} ${t}`);
  }

  // 3. Row counts (service role bypasses RLS)
  console.log('\n── 3. ROW COUNTS (service role, bypasses RLS) ──');
  for (const t of TABLES) {
    if (!existingTables.has(t)) { console.log(`  ⚪ ${t} — missing`); continue; }
    try {
      const r = await sql(`SELECT COUNT(*) AS cnt FROM public.${t};`);
      console.log(`  ${t}: ${r[0]?.cnt ?? '?'} rows`);
    } catch (e) {
      console.log(`  ${t}: ERROR — ${e.message}`);
    }
  }

  // 4. Rows WITH null company_id (the silent poison)
  console.log('\n── 4. ROWS WITH NULL company_id (invisible to RLS) ──');
  for (const t of TABLES) {
    if (!existingTables.has(t) || !hasCompanyId.has(t)) continue;
    try {
      const r = await sql(`SELECT COUNT(*) AS cnt FROM public.${t} WHERE company_id IS NULL;`);
      const count = Number(r[0]?.cnt ?? 0);
      console.log(`  ${t}: ${count} null-company rows ${count > 0 ? '⚠️  PROBLEM' : '✅'}`);
    } catch (e) {
      console.log(`  ${t}: ERROR — ${e.message}`);
    }
  }

  // 5. RLS status
  console.log('\n── 5. RLS STATUS ───────────────────────────');
  const rlsResult = await sql(`
    SELECT relname AS table_name, relrowsecurity AS rls_enabled
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relkind = 'r'
      AND relname = ANY(ARRAY[${TABLES.map(t => `'${t}'`).join(',')}])
    ORDER BY relname;
  `);
  for (const row of rlsResult) {
    console.log(`  ${row.rls_enabled ? '🔒 RLS ON' : '⚠️  RLS OFF'} ${row.table_name}`);
  }

  // 6. RLS policy list for the module tables
  console.log('\n── 6. RLS POLICIES ON MODULE TABLES ───────');
  const policyResult = await sql(`
    SELECT schemaname, tablename, policyname, cmd, qual
    FROM pg_policies
    WHERE tablename = ANY(ARRAY[${TABLES.map(t => `'${t}'`).join(',')}])
    ORDER BY tablename, policyname;
  `);
  if (policyResult.length === 0) {
    console.log('  ⚠️  NO POLICIES FOUND on any module table — all queries will be blocked by RLS');
  } else {
    let lastTable = '';
    for (const p of policyResult) {
      if (p.tablename !== lastTable) { console.log(`\n  ${p.tablename}:`); lastTable = p.tablename; }
      console.log(`    [${p.cmd}] "${p.policyname}"`);
    }
  }

  // 7. Distinct company_ids present in each table
  console.log('\n── 7. DISTINCT company_ids IN DATA ─────────');
  for (const t of TABLES) {
    if (!existingTables.has(t) || !hasCompanyId.has(t)) continue;
    try {
      const r = await sql(`SELECT DISTINCT company_id FROM public.${t} LIMIT 5;`);
      if (r.length === 0) { console.log(`  ${t}: (empty)`); }
      else { console.log(`  ${t}: ${r.map(x => x.company_id ?? 'NULL').join(', ')}`); }
    } catch (e) {
      console.log(`  ${t}: ERROR — ${e.message}`);
    }
  }

  // 8. Check is_company_member function exists
  console.log('\n── 8. is_company_member FUNCTION ───────────');
  try {
    const r = await sql(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'is_company_member'
        AND pronamespace = 'public'::regnamespace;
    `);
    if (r.length === 0) {
      console.log('  ❌ is_company_member MISSING — RLS policies will fail');
    } else {
      console.log('  ✅ is_company_member exists');
      console.log('  Body preview:', r[0].prosrc?.slice(0, 200));
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  // 9. companies table — any rows?
  console.log('\n── 9. COMPANIES TABLE ───────────────────────');
  try {
    const r = await sql(`SELECT id, name FROM public.companies LIMIT 5;`);
    console.log(`  ${r.length} companies found:`);
    r.forEach(c => console.log(`    id=${c.id}  name=${c.name}`));
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  // 10. company_users — any rows?
  console.log('\n── 10. company_users TABLE ─────────────────');
  try {
    const r = await sql(`SELECT user_id, company_id, role FROM public.company_users LIMIT 5;`);
    console.log(`  ${r.length} rows found:`);
    r.forEach(u => console.log(`    user=${u.user_id}  company=${u.company_id}  role=${u.role}`));
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  console.log('\n══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
