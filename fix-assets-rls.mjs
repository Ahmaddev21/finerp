/**
 * Fixes assets table RLS policies:
 *   - Old policies used legacy role names (super_admin, moderator, bd)
 *   - New policies use current 7-role names (owner, admin, bdm, engineer, etc.)
 *   - Also adds a `status` column (Active/Standby/Inactive) for vehicle tracking
 */
const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) { console.error('SUPABASE_PAT required'); process.exit(1); }

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || JSON.stringify(body));
  return body;
}

const steps = [
  {
    label: 'Add status column to assets (nullable, default Active)',
    query: `
      ALTER TABLE public.assets
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active'
          CHECK (status IN ('Active', 'Standby', 'Inactive'));
    `,
  },
  {
    label: 'Drop old SELECT policy (legacy role names)',
    query: `DROP POLICY IF EXISTS "Users can view company assets" ON public.assets;`,
  },
  {
    label: 'Drop old INSERT policy',
    query: `DROP POLICY IF EXISTS "Users can insert company assets" ON public.assets;`,
  },
  {
    label: 'Drop old UPDATE policy',
    query: `DROP POLICY IF EXISTS "Users can update company assets" ON public.assets;`,
  },
  {
    label: 'Drop old DELETE policy',
    query: `DROP POLICY IF EXISTS "Users can delete company assets" ON public.assets;`,
  },
  {
    label: 'Create SELECT policy (all company members)',
    query: `
      CREATE POLICY "assets_select" ON public.assets FOR SELECT
        USING (
          company_id IN (
            SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
          )
        );
    `,
  },
  {
    label: 'Create INSERT policy (owner, admin, bdm, engineer)',
    query: `
      CREATE POLICY "assets_insert" ON public.assets FOR INSERT
        WITH CHECK (
          company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
          AND (
            SELECT role FROM public.company_users
            WHERE user_id = auth.uid() AND company_id = assets.company_id
            LIMIT 1
          ) IN ('owner', 'admin', 'bdm', 'engineer')
        );
    `,
  },
  {
    label: 'Create UPDATE policy (owner, admin, bdm, engineer)',
    query: `
      CREATE POLICY "assets_update" ON public.assets FOR UPDATE
        USING (
          company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
        )
        WITH CHECK (
          (
            SELECT role FROM public.company_users
            WHERE user_id = auth.uid() AND company_id = assets.company_id
            LIMIT 1
          ) IN ('owner', 'admin', 'bdm', 'engineer')
        );
    `,
  },
  {
    label: 'Create DELETE policy (owner, admin)',
    query: `
      CREATE POLICY "assets_delete" ON public.assets FOR DELETE
        USING (
          (
            SELECT role FROM public.company_users
            WHERE user_id = auth.uid() AND company_id = assets.company_id
            LIMIT 1
          ) IN ('owner', 'admin')
        );
    `,
  },
  {
    label: 'Reload PostgREST schema cache',
    query: `NOTIFY pgrst, 'reload schema';`,
  },
];

console.log('\n── Fixing assets RLS policies ───────────────────────────');
for (const step of steps) {
  process.stdout.write(`  ${step.label}... `);
  try {
    await sql(step.query);
    console.log('✅');
  } catch (err) {
    console.log(`❌\n  ${err.message}\n`);
    process.exit(1);
  }
}

// Verify
console.log('\n── Verification ─────────────────────────────────────────');
const policies = await sql(`
  SELECT policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'assets'
  ORDER BY policyname
`);
console.log('  Active policies:');
for (const p of policies) {
  console.log(`    ${p.policyname} (${p.cmd})`);
}

const cols = await sql(`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'assets'
    AND column_name IN ('status', 'expiry_date', 'estemara_expiry_date')
  ORDER BY ordinal_position
`);
console.log('\n  Relevant columns:');
for (const c of cols) {
  console.log(`    ${c.column_name}  (${c.data_type}, default=${c.column_default})`);
}
console.log('─────────────────────────────────────────────────────────\n');
