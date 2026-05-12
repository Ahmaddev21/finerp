-- ═══════════════════════════════════════════════════════════════════
-- ASSETS MODULE SCHEMA MIGRATION
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  purchase_amount numeric NOT NULL DEFAULT 0,
  purchase_date date,
  estemara_expiry_date date,
  ownership_type text NOT NULL,
  remarks text,
  moved_to text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy
DROP POLICY IF EXISTS "Users can view company assets" ON public.assets;
CREATE POLICY "Users can view company assets"
ON public.assets FOR SELECT
USING (company_id IN (
    SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid() AND cu.role IN ('super_admin', 'admin', 'moderator', 'bdm', 'bd')
));

-- 2. INSERT policy
DROP POLICY IF EXISTS "Users can insert company assets" ON public.assets;
CREATE POLICY "Users can insert company assets"
ON public.assets FOR INSERT
WITH CHECK (company_id IN (
    SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid() AND cu.role IN ('super_admin', 'admin', 'moderator', 'bdm', 'bd')
));

-- 3. UPDATE policy
DROP POLICY IF EXISTS "Users can update company assets" ON public.assets;
CREATE POLICY "Users can update company assets"
ON public.assets FOR UPDATE
USING (company_id IN (
    SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid() AND cu.role IN ('super_admin', 'admin', 'moderator', 'bdm', 'bd')
));

-- 4. DELETE policy
DROP POLICY IF EXISTS "Users can delete company assets" ON public.assets;
CREATE POLICY "Users can delete company assets"
ON public.assets FOR DELETE
USING (company_id IN (
    SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid() AND cu.role IN ('super_admin', 'admin', 'moderator', 'bdm', 'bd')
));

-- Inform PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
