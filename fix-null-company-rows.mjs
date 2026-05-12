/**
 * Fixes all rows with NULL company_id by assigning them to the correct company.
 * Strategy: find the most likely owner via contracts.created_by or by the sole
 * owner in company_users, then UPDATE all orphaned rows.
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
  console.log('  Fix NULL company_id rows');
  console.log('══════════════════════════════════════════\n');

  // Step 1: inspect existing NULL rows to find clues about owner
  console.log('── Inspecting NULL-company rows ────────────\n');

  // Check contracts for created_by or any user reference
  const contractCols = await sql(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts'
    ORDER BY ordinal_position;
  `);
  console.log('contracts columns:', contractCols.map(c => c.column_name).join(', '));

  const engCols = await sql(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'engagements'
    ORDER BY ordinal_position;
  `);
  console.log('engagements columns:', engCols.map(c => c.column_name).join(', '));

  // Show sample rows from contracts
  const contracts = await sql(`SELECT * FROM public.contracts LIMIT 6;`);
  console.log('\ncontracts sample rows:', JSON.stringify(contracts, null, 2));

  const engs = await sql(`SELECT * FROM public.engagements LIMIT 5;`);
  console.log('\nengagements sample rows:', JSON.stringify(engs, null, 2));

  // Step 2: find the right company_id
  // Look at company_users — find the owner account
  const users = await sql(`
    SELECT cu.user_id, cu.company_id, cu.role, c.name AS company_name
    FROM public.company_users cu
    JOIN public.companies c ON c.id = cu.company_id
    ORDER BY c.created_at ASC
    LIMIT 10;
  `);
  console.log('\ncompany_users + companies:');
  users.forEach(u => console.log(`  user=${u.user_id}  company=${u.company_id}  role=${u.role}  name=${u.company_name}`));

  // Try to match created_by in contracts/engagements to a user_id in company_users
  const contractCreatedBy = contracts
    .map(c => c.created_by)
    .filter(Boolean);
  console.log('\ncontracts.created_by values:', contractCreatedBy);

  const engCreatedBy = engs
    .map(e => e.created_by)
    .filter(Boolean);
  console.log('engagements.created_by values:', engCreatedBy);

  // Find matching company for each created_by
  let targetCompanyId = null;

  // Check if any created_by matches a company_user
  const allCreatedBy = [...new Set([...contractCreatedBy, ...engCreatedBy])];
  for (const userId of allCreatedBy) {
    const match = users.find(u => u.user_id === userId);
    if (match) {
      targetCompanyId = match.company_id;
      console.log(`\n✅ Matched created_by=${userId} → company=${targetCompanyId} (${match.company_name})`);
      break;
    }
  }

  // If no created_by match, fall back to the first owner company
  if (!targetCompanyId) {
    const ownerUser = users.find(u => u.role === 'owner');
    if (ownerUser) {
      targetCompanyId = ownerUser.company_id;
      console.log(`\n⚠️  No created_by match — using first owner company: ${targetCompanyId}`);
    }
  }

  if (!targetCompanyId) {
    console.error('\n❌ Cannot determine target company. Please check company_users table.');
    process.exit(1);
  }

  // Step 3: UPDATE all NULL-company rows across all tables
  console.log(`\n── Updating NULL rows → company_id = ${targetCompanyId} ──\n`);

  for (const table of TABLES) {
    try {
      const countRes = await sql(`SELECT COUNT(*) AS cnt FROM public.${table} WHERE company_id IS NULL;`);
      const count = Number(countRes[0]?.cnt ?? 0);
      if (count === 0) {
        console.log(`  ✅ ${table}: no NULL rows`);
        continue;
      }
      const updateRes = await sql(`
        UPDATE public.${table}
        SET company_id = '${targetCompanyId}'
        WHERE company_id IS NULL;
      `);
      console.log(`  ✅ ${table}: updated ${count} rows → company_id set`);
    } catch (e) {
      console.log(`  ❌ ${table}: ERROR — ${e.message}`);
    }
  }

  // Step 4: Verify
  console.log('\n── Post-fix verification ────────────────────\n');
  for (const table of TABLES) {
    try {
      const total = await sql(`SELECT COUNT(*) AS cnt FROM public.${table};`);
      const nullRows = await sql(`SELECT COUNT(*) AS cnt FROM public.${table} WHERE company_id IS NULL;`);
      const visible = await sql(`SELECT COUNT(*) AS cnt FROM public.${table} WHERE company_id = '${targetCompanyId}';`);
      console.log(`  ${table}: total=${total[0].cnt}  null=${nullRows[0].cnt}  visible_to_company=${visible[0].cnt}`);
    } catch (e) {
      console.log(`  ${table}: ERROR — ${e.message}`);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Done. Company ID used: ${targetCompanyId}`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
