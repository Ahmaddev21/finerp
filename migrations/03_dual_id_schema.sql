-- ───────────────────────────────────────────────────────────────────
-- PHASE 3: SAFE DUAL-ID MIGRATION
-- Fix: uuid_id must be declared NOT NULL after backfill so that
--      explicit NULL inserts are rejected, not just inserts that
--      omit the column (which DEFAULT already handles).
-- ───────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Add internal UUID column to deliveries (non-destructive — keeps TEXT id intact)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();

-- Backfill any existing rows that somehow have NULL (safety net)
UPDATE public.deliveries SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

-- Lock it down: no explicit NULL inserts allowed
ALTER TABLE public.deliveries ALTER COLUMN uuid_id SET NOT NULL;

-- Unique index (idempotent — checks both the auto-name and our named constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deliveries'::regclass
      AND contype = 'u'
      AND conname IN ('deliveries_uuid_id_key', 'deliveries_uuid_id_unique')
  ) THEN
    ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_uuid_id_key UNIQUE (uuid_id);
  END IF;
END $$;


-- 2. Add delivery_uuid column to merchandise (non-destructive — keeps TEXT delivery_id intact)
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS delivery_uuid UUID;

-- Migrate existing TEXT delivery_id links → UUID uuid_id
-- Merchandise rows with no matching delivery row are left with delivery_uuid = NULL (orphans).
UPDATE public.merchandise m
SET delivery_uuid = d.uuid_id
FROM public.deliveries d
WHERE m.delivery_id = d.id;


-- 3. Add Foreign Key constraint (without dropping old delivery_id column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchandise_delivery_uuid_fkey'
      AND conrelid = 'public.merchandise'::regclass
  ) THEN
    ALTER TABLE public.merchandise
      ADD CONSTRAINT merchandise_delivery_uuid_fkey
      FOREIGN KEY (delivery_uuid) REFERENCES public.deliveries(uuid_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
