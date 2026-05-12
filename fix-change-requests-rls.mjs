/**
 * Fixes change_requests table — adds missing INSERT RLS policy
 * so non-owner users can submit change requests for approval.
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
    label: 'Ensure RLS is enabled on change_requests',
    query: `ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;`,
  },
  {
    label: 'Drop existing INSERT policy if any (idempotent)',
    query: `DROP POLICY IF EXISTS "change_requests_insert" ON public.change_requests;`,
  },
  {
    label: 'Create INSERT policy (any company member)',
    query: `
      CREATE POLICY "change_requests_insert" ON public.change_requests FOR INSERT
        WITH CHECK (
          company_id IN (
            SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
          )
        );
    `,
  },
  {
    label: 'Ensure SELECT policy exists (view own company requests)',
    query: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'change_requests'
            AND policyname = 'change_requests_select'
        ) THEN
          CREATE POLICY "change_requests_select" ON public.change_requests FOR SELECT
            USING (
              company_id IN (
                SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
              )
            );
        END IF;
      END $$;
    `,
  },
  {
    label: 'Ensure UPDATE policy exists (owner/admin can review)',
    query: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'change_requests'
            AND policyname = 'change_requests_update'
        ) THEN
          CREATE POLICY "change_requests_update" ON public.change_requests FOR UPDATE
            USING (
              company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
            )
            WITH CHECK (
              (
                SELECT role FROM public.company_users
                WHERE user_id = auth.uid() AND company_id = change_requests.company_id
                LIMIT 1
              ) IN ('owner', 'admin')
            );
        END IF;
      END $$;
    `,
  },
  {
    label: 'Reload PostgREST schema cache',
    query: `NOTIFY pgrst, 'reload schema';`,
  },
];

console.log('\n── Fixing change_requests RLS ───────────────────────────');
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
  WHERE schemaname = 'public' AND tablename = 'change_requests'
  ORDER BY policyname
`);
console.log('  Active change_requests policies:');
for (const p of policies) {
  console.log(`    ${p.policyname} (${p.cmd})`);
}
console.log('─────────────────────────────────────────────────────────\n');
