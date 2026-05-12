-- Fix for company_users RLS to ensure self-visibility and prevent orphaned owners
-- Run this in your Supabase SQL Editor

-- 1. Ensure users can always see their own membership record
DROP POLICY IF EXISTS "Users can always view their own membership" ON public.company_users;
CREATE POLICY "Users can always view their own membership"
  ON public.company_users FOR SELECT
  USING (user_id = auth.uid());

-- 2. Ensure owners can always see companies they personally created
DROP POLICY IF EXISTS "Owners can always see their created companies" ON public.companies;
CREATE POLICY "Owners can always see their created companies"
  ON public.companies FOR SELECT
  USING (user_id = auth.uid());
