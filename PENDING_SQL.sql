-- ─────────────────────────────────────────────────────────────────────
-- Run these in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────

-- Allow Word (.doc / .docx) uploads in the finance_attachments bucket
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
WHERE name = 'finance_attachments'
  AND NOT (allowed_mime_types @> ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- Verify what the bucket now allows:
SELECT name, allowed_mime_types FROM storage.buckets WHERE name = 'finance_attachments';
