/**
 * Delivery Documents migration — uses node-postgres (pg) to connect directly.
 */
import pkg from 'pg';
const { Client } = pkg;

const PROJECT_REF = 'iwrrratnesjqxwkszwxd';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cnJyYXRuZXNqcXh3a3N6d3hkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUxNjY3MiwiZXhwIjoyMDkyMDkyNjcyfQ.CvQv0JenT3z9AvvEqWeQT4WzBUxFY9vGIllFnXTrwlQ';

// Supabase session-mode connection (port 5432) — uses service role JWT as password
const client = new Client({
  host:     `db.${PROJECT_REF}.supabase.co`,
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: SERVICE_KEY,
  ssl:      { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run(label, sql) {
  process.stdout.write(`  ${label}... `);
  try {
    await client.query(sql);
    console.log('✅');
  } catch (e) {
    console.log(`❌  ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Delivery Documents — DB Migration');
  console.log('══════════════════════════════════════════\n');

  console.log('  Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('  ✅ Connected\n');

  await run('Create delivery_documents table', `
    CREATE TABLE IF NOT EXISTS public.delivery_documents (
      id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      delivery_id  text NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
      company_id   uuid NOT NULL,
      file_path    text NOT NULL,
      file_name    text NOT NULL,
      file_size    bigint,
      mime_type    text,
      uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at   timestamptz DEFAULT now()
    )
  `);

  await run('Create index on delivery_id', `
    CREATE INDEX IF NOT EXISTS delivery_documents_delivery_id_idx
      ON public.delivery_documents (delivery_id)
  `);

  await run('Enable RLS', `
    ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY
  `);

  await run('Drop old policies (idempotent)', `
    DO $$
    BEGIN
      DROP POLICY IF EXISTS "delivery_docs_select" ON public.delivery_documents;
      DROP POLICY IF EXISTS "delivery_docs_insert" ON public.delivery_documents;
      DROP POLICY IF EXISTS "delivery_docs_delete" ON public.delivery_documents;
    END $$
  `);

  await run('Create SELECT policy', `
    CREATE POLICY "delivery_docs_select" ON public.delivery_documents FOR SELECT
      USING (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ))
  `);

  await run('Create INSERT policy', `
    CREATE POLICY "delivery_docs_insert" ON public.delivery_documents FOR INSERT
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ))
  `);

  await run('Create DELETE policy', `
    CREATE POLICY "delivery_docs_delete" ON public.delivery_documents FOR DELETE
      USING (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ))
  `);

  await run('Update storage bucket (10MB + MIME types)', `
    UPDATE storage.buckets
    SET file_size_limit    = 10485760,
        allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/heic']
    WHERE id = 'finance_attachments'
  `);

  // Verify
  console.log('\n── Verification ─────────────────────────────');

  const tableRes = await client.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'delivery_documents'
  `);
  console.log(`  delivery_documents table: ${tableRes.rows[0].cnt === '1' ? '✅ exists' : '❌ missing'}`);

  const policyRes = await client.query(`
    SELECT policyname FROM pg_policies WHERE tablename = 'delivery_documents' ORDER BY policyname
  `);
  console.log(`  RLS policies: ${policyRes.rows.map(r => r.policyname).join(', ') || 'none'}`);

  const bucketRes = await client.query(`
    SELECT file_size_limit FROM storage.buckets WHERE id = 'finance_attachments'
  `);
  console.log(`  Storage bucket limit: ${bucketRes.rows[0]?.file_size_limit ?? 'unknown'} bytes`);

  await client.end();

  console.log('\n══════════════════════════════════════════');
  console.log('  Migration complete ✅');
  console.log('══════════════════════════════════════════\n');
}

main().catch(async e => {
  console.error('\nFatal:', e.message);
  await client.end().catch(() => {});
  process.exit(1);
});
