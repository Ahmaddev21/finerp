const PAT = process.env.SUPABASE_PAT;
if (!PAT) {
  console.error('SUPABASE_PAT environment variable is required');
  process.exit(1);
}

const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runQuery(label, sql) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`QUERY: ${label}`);
  console.log('='.repeat(70));
  console.log(`SQL:\n${sql.trim()}\n`);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log(`HTTP Status: ${res.status} ${res.statusText}`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.log('RAW RESPONSE (not JSON):', text);
    return;
  }

  if (!res.ok) {
    console.log('ERROR RESPONSE:', JSON.stringify(parsed, null, 2));
    return;
  }

  console.log(`RESULT (${Array.isArray(parsed) ? parsed.length : '?'} rows):`);
  if (Array.isArray(parsed) && parsed.length === 0) {
    console.log('  (empty result set)');
  } else {
    console.log(JSON.stringify(parsed, null, 2));
  }
}

// Query 1: All columns in deliveries
await runQuery(
  'All columns in deliveries table',
  `SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deliveries'
ORDER BY ordinal_position;`
);

// Query 2: All columns in merchandise
await runQuery(
  'All columns in merchandise table',
  `SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'merchandise'
ORDER BY ordinal_position;`
);

// Query 3: All constraints on both tables
await runQuery(
  'All constraints on deliveries and merchandise',
  `SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' AND tc.table_name IN ('deliveries', 'merchandise')
ORDER BY tc.table_name, tc.constraint_type;`
);

// Query 4: All indexes on both tables
await runQuery(
  'All indexes on deliveries and merchandise',
  `SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('deliveries', 'merchandise')
ORDER BY tablename, indexname;`
);

// Query 5: Sample data from deliveries (first 3 rows)
await runQuery(
  'Sample data from deliveries (first 3 rows, all columns)',
  `SELECT * FROM public.deliveries LIMIT 3;`
);

// Query 6: Check specific columns exist
await runQuery(
  'Check if delivery_code, uuid_id, delivery_uuid columns exist',
  `SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'delivery_code'
) AS delivery_code_exists,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'uuid_id'
) AS uuid_id_exists,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'merchandise' AND column_name = 'delivery_uuid'
) AS delivery_uuid_exists;`
);

console.log('\n' + '='.repeat(70));
console.log('AUDIT COMPLETE');
console.log('='.repeat(70));
