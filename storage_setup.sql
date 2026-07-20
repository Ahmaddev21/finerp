-- ═══════════════════════════════════════════════════════════════════
-- FinERP Storage Setup — Supabase Storage for Document Attachments
-- Run in: Supabase Dashboard → SQL Editor → AFTER schema_migration_v2.sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create the 'finance_attachments' bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'finance_attachments',
  'finance_attachments',
  false, -- Private bucket (authenticated only)
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. Storage RLS Policies (company-scoped paths: {company_id}/{type}/{record_id}/{filename})

-- Drop existing policies safely
DO $$
BEGIN
  BEGIN DROP POLICY "finerp_upload" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "finerp_view" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY "finerp_delete" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- INSERT: Users can upload to their company's folder
CREATE POLICY "finerp_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- SELECT: Users can view files in their company's folder
CREATE POLICY "finerp_view"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);

-- DELETE: Users can delete files in their company's folder
CREATE POLICY "finerp_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);
