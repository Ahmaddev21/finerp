-- Fix: add SELECT policy so authenticated users can generate signed URLs
-- Run in: Supabase Dashboard → SQL Editor

DO $$
BEGIN
  BEGIN DROP POLICY "finerp_view" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "finerp_view"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance_attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_users WHERE user_id = auth.uid()
  )
);
