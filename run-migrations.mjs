/**
 * FinERP Migration Runner
 * Executes Phase 1 → 2 → 3 in order against Supabase via Management API.
 *
 * Usage:
 *   SUPABASE_PAT=your_token node run-migrations.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) {
  console.error('\n❌  SUPABASE_PAT environment variable is required.');
  console.error('    Get yours at: https://supabase.com/dashboard/account/tokens');
  console.error('    Then run:  SUPABASE_PAT=your_token node run-migrations.mjs\n');
  process.exit(1);
}

const MIGRATIONS = [
  { file: 'migrations/01_role_integrity.sql',  label: 'Phase 1 — Role Integrity & RLS Hardening' },
  { file: 'migrations/02_invite_logic.sql',    label: 'Phase 2 — Invite Logic & Usage Tracking'  },
  { file: 'migrations/03_dual_id_schema.sql',  label: 'Phase 3 — Safe Dual-ID Migration'          },
];

async function runSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.message || JSON.stringify(body));
  }

  return body;
}

async function verify() {
  console.log('\n── Verification ─────────────────────────────────────────');

  // Phase 1: role constraint exists
  const p1 = await runSQL(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.company_users'::regclass
      AND conname = 'company_users_role_check'
  `);
  console.log(`  company_users_role_check:  ${p1.length ? '✅' : '❌'}`);

  // Phase 1: non-recursive policies exist
  const rls = await runSQL(`
    SELECT policyname FROM pg_policies
    WHERE tablename = 'company_users'
      AND policyname IN ('company_users_select', 'company_users_manage')
  `);
  console.log(`  Non-recursive RLS policies: ${rls.length === 2 ? '✅' : `❌ (found ${rls.length}/2)`}`);

  // Phase 2: only 3-arg generate_company_invite exists
  const fn = await runSQL(`
    SELECT pronargs FROM pg_proc WHERE proname = 'generate_company_invite'
  `);
  const args = fn.map(r => r.pronargs);
  console.log(`  generate_company_invite overloads: ${JSON.stringify(args)} ${args.includes(2) ? '❌ old 2-arg still exists!' : '✅'}`);

  // Phase 3: uuid_id column NOT NULL on deliveries
  const col = await runSQL(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'uuid_id'
  `);
  const nullable = col[0]?.is_nullable;
  console.log(`  deliveries.uuid_id NOT NULL: ${nullable === 'NO' ? '✅' : `❌ is_nullable = ${nullable}`}`);

  console.log('─────────────────────────────────────────────────────────\n');
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        FinERP — Migration Runner                     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  for (const { file, label } of MIGRATIONS) {
    const filePath = path.join(__dirname, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    process.stdout.write(`Running ${label}... `);

    try {
      await runSQL(sql);
      console.log('✅');
    } catch (err) {
      console.log(`❌\n\nError in ${file}:\n  ${err.message}\n`);
      process.exit(1);
    }
  }

  await verify();
  console.log('All 3 migrations complete.\n');
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
