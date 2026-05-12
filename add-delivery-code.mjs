/**
 * Adds the missing delivery_code column to deliveries table.
 * Backfills existing rows from their text id (DEL-001 → delivery_code='DEL-001'),
 * then reloads the PostgREST schema cache.
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
    label: 'Add delivery_code column (nullable first)',
    query: `ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_code TEXT;`,
  },
  {
    label: 'Backfill existing rows (copy text id → delivery_code)',
    query: `UPDATE public.deliveries SET delivery_code = id WHERE delivery_code IS NULL;`,
  },
  {
    label: 'Set NOT NULL after backfill',
    query: `ALTER TABLE public.deliveries ALTER COLUMN delivery_code SET NOT NULL;`,
  },
  {
    label: 'Reload PostgREST schema cache',
    query: `NOTIFY pgrst, 'reload schema';`,
  },
];

console.log('\n── Adding delivery_code column ──────────────────────────');
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
const cols = await sql(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'deliveries'
    AND column_name IN ('id', 'uuid_id', 'delivery_code')
  ORDER BY ordinal_position
`);
for (const c of cols) {
  console.log(`  deliveries.${c.column_name}  (${c.data_type}, nullable=${c.is_nullable})`);
}

const sample = await sql(`SELECT id, uuid_id, delivery_code FROM public.deliveries LIMIT 3`);
console.log('\n  Sample rows:');
for (const r of sample) {
  console.log(`    id=${r.id}  uuid_id=${r.uuid_id?.slice(0,8)}...  delivery_code=${r.delivery_code}`);
}
console.log('─────────────────────────────────────────────────────────\n');
