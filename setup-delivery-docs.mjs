/**
 * Creates the delivery_documents table + RLS policies in Supabase.
 * Usage: SUPABASE_PAT=YOUR_SUPABASE_PAT node setup-delivery-docs.mjs
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

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Delivery Documents — DB Setup');
  console.log('══════════════════════════════════════════\n');

  // 1. Create table
  console.log('── Creating delivery_documents table ───────');
  await sql(`
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
    );
  `);
  console.log('  ✅ delivery_documents table ready');

  // 2. Index for fast lookup by delivery_id
  await sql(`
    CREATE INDEX IF NOT EXISTS delivery_documents_delivery_id_idx
      ON public.delivery_documents (delivery_id);
  `);
  console.log('  ✅ Index on delivery_id created');

  // 3. Enable RLS
  await sql(`ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;`);
  console.log('  ✅ RLS enabled');

  // 4. Drop old policies if any, then recreate
  const policies = ['delivery_docs_select', 'delivery_docs_insert', 'delivery_docs_delete'];
  for (const p of policies) {
    await sql(`DROP POLICY IF EXISTS "${p}" ON public.delivery_documents;`).catch(() => {});
  }

  await sql(`
    CREATE POLICY "delivery_docs_select" ON public.delivery_documents FOR SELECT
      USING (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ));
  `);

  await sql(`
    CREATE POLICY "delivery_docs_insert" ON public.delivery_documents FOR INSERT
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ));
  `);

  await sql(`
    CREATE POLICY "delivery_docs_delete" ON public.delivery_documents FOR DELETE
      USING (company_id IN (
        SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
      ));
  `);
  console.log('  ✅ RLS policies created (select / insert / delete)');

  // 5. Verify storage bucket exists and update allowed MIME types to include PDFs + images
  console.log('\n── Verifying storage bucket ─────────────────');
  const buckets = await sql(`SELECT id, name, file_size_limit FROM storage.buckets WHERE id = 'finance_attachments';`);
  if (buckets.length > 0) {
    console.log(`  ✅ finance_attachments bucket exists (limit: ${buckets[0].file_size_limit} bytes)`);
    // Raise limit to 10MB for delivery docs (scanned documents can be large)
    await sql(`
      UPDATE storage.buckets
      SET file_size_limit = 10485760,
          allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/heic']
      WHERE id = 'finance_attachments';
    `);
    console.log('  ✅ Bucket limit updated to 10MB, PDF+image MIME types confirmed');
  } else {
    console.log('  ⚠️  finance_attachments bucket missing — run storage_setup.sql first');
  }

  // 6. Verify
  console.log('\n── Verification ─────────────────────────────');
  const tableCheck = await sql(`
    SELECT COUNT(*) AS cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'delivery_documents';
  `);
  console.log(`  delivery_documents table exists: ${tableCheck[0].cnt === '1' ? '✅' : '❌'}`);

  const policyCheck = await sql(`
    SELECT policyname FROM pg_policies WHERE tablename = 'delivery_documents';
  `);
  console.log(`  Policies: ${policyCheck.map(p => p.policyname).join(', ')}`);

  console.log('\n══════════════════════════════════════════');
  console.log('  Done. Run: SUPABASE_PAT=YOUR_SUPABASE_PAT node setup-delivery-docs.mjs');
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
