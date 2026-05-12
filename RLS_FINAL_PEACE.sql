-- RLS FINAL PEACE: THE RECURSION KILLER
-- Run this in your Supabase SQL Editor

-- 1. CLEANUP (Drop ALL potentially recursive policies)
DROP POLICY IF EXISTS "company_users_select" ON public.company_users;
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "Members can view change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Members can insert change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;

-- 2. ISOLATED HELPERS (Non-Recursive Base-Table Lookups)
-- Using SECURITY DEFINER to bypass the primary RLS path
CREATE OR REPLACE FUNCTION public.is_owner_v3(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_member_v3(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY STABLE POLICIES
CREATE POLICY "companies_select_final"
  ON public.companies FOR SELECT
  USING (user_id = auth.uid() OR public.is_member_v3(id));

CREATE POLICY "company_users_select_final"
  ON public.company_users FOR SELECT
  USING (user_id = auth.uid() OR public.is_owner_v3(company_id));

CREATE POLICY "transactions_select_final"
  ON public.transactions FOR SELECT
  USING (public.is_member_v3(company_id));

CREATE POLICY "change_requests_select_final"
  ON public.change_requests FOR SELECT
  USING (public.is_member_v3(company_id));

-- 4. THE INDESTRUCTIBLE VIEW (Bypasses API Join Ambiguity)
-- We use SECURITY DEFINER for the view itself to ensure the join is pre-calculated
CREATE OR REPLACE VIEW public.member_profiles 
WITH (security_invoker = false) -- This view runs with system privileges
AS 
SELECT 
    cu.id,
    cu.company_id,
    cu.user_id,
    cu.role,
    p.username,
    p.avatar_url
FROM public.company_users cu
LEFT JOIN public.profiles p ON cu.user_id = p.id;

-- 5. FINAL PERMISSIONS & CACHE RELOAD
GRANT SELECT ON public.member_profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
