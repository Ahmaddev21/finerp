-- RLS DISASTER RECOVERY v2: Definitive Recursion Break
-- Run this in your Supabase SQL Editor

-- 1. CLEANUP (Drop ALL previous variations to be safe)
DROP POLICY IF EXISTS "company_users_self_view" ON public.company_users;
DROP POLICY IF EXISTS "company_users_owner_view" ON public.company_users;
DROP POLICY IF EXISTS "companies_owner_view" ON public.companies;
DROP POLICY IF EXISTS "companies_member_view" ON public.companies;
DROP POLICY IF EXISTS "Company members can view company" ON public.companies;
DROP POLICY IF EXISTS "Users can view members of their company" ON public.company_users;
DROP POLICY IF EXISTS "Users can always view their own membership" ON public.company_users;
DROP POLICY IF EXISTS "Owners can always see their created companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can manage users" ON public.company_users;

-- 2. SECURITY DEFINER HELPERS (Bypass RLS to break recursion)
CREATE OR REPLACE FUNCTION public.is_owner_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_member_of_company(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY NON-RECURSIVE POLICIES
CREATE POLICY "company_users_select"
  ON public.company_users FOR SELECT
  USING (
    user_id = auth.uid() OR 
    public.is_owner_of_company(company_id)
  );

CREATE POLICY "companies_select"
  ON public.companies FOR SELECT
  USING (
    user_id = auth.uid() OR 
    public.is_member_of_company(id)
  );

-- 4. UPDATE GLOBAL HELPER
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN public.is_member_of_company(p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
