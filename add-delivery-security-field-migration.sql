-- ═══════════════════════════════════════════════════════════════════
-- Delivery module — add free-text "Security" field
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS security TEXT;

-- ─────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'security';
