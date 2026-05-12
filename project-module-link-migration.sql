-- ═══════════════════════════════════════════════════════════════════
-- FinERP: Link Contracting & Consultancy modules to main Projects
-- Safe to re-run — all operations use ADD COLUMN IF NOT EXISTS
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════
--
-- Data model after this migration:
--   contracting_projects.main_project_id  → projects(id)
--   consultancy_invoices_out.main_project_id → projects(id)
--   consultancy_invoices_in.main_project_id  → projects(id)
--
-- Contracting revenue for a main project:
--   contracting_invoices_out WHERE project_id IN
--     (SELECT id FROM contracting_projects WHERE main_project_id = $pid)
--
-- Consultancy revenue for a main project:
--   consultancy_invoices_out WHERE main_project_id = $pid
-- ═══════════════════════════════════════════════════════════════════

-- 1. contracting_projects → link to main project
ALTER TABLE public.contracting_projects
  ADD COLUMN IF NOT EXISTS main_project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ctr_proj_main_project
  ON public.contracting_projects(main_project_id)
  WHERE main_project_id IS NOT NULL;

-- 2. consultancy_invoices_out → link to main project
ALTER TABLE public.consultancy_invoices_out
  ADD COLUMN IF NOT EXISTS main_project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_con_inv_out_main_project
  ON public.consultancy_invoices_out(main_project_id)
  WHERE main_project_id IS NOT NULL;

-- 3. consultancy_invoices_in → link to main project (tracks partner costs per project)
ALTER TABLE public.consultancy_invoices_in
  ADD COLUMN IF NOT EXISTS main_project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_con_inv_in_main_project
  ON public.consultancy_invoices_in(main_project_id)
  WHERE main_project_id IS NOT NULL;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'project-module-link-migration applied' AS status;
