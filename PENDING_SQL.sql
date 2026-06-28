-- ─────────────────────────────────────────────────────────────────────
-- Run these two statements in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────

-- STEP 7: New merchandise item columns (EM Box, Safety Kit, Chest Guard, Winter Jacket)
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS em_box_qty        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS safety_kit_qty    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS chest_guard_qty   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.merchandise ADD COLUMN IF NOT EXISTS winter_jacket_qty INTEGER NOT NULL DEFAULT 0;

-- STEP 8: source column on projects (marks rows auto-created from Contracting)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source TEXT;
