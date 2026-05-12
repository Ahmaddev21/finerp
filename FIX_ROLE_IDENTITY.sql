-- Fix for Role Identity Loss & Vanishing Transactions
-- Run this in Supabase SQL Editor to resolve recursive RLS policies

-- 1. Fix company_users SELECT policy (Was recursive, leading to 'member' downgrade)
DROP POLICY IF EXISTS "Users can view members of their company" ON public.company_users;
CREATE POLICY "Users can view members of their company"
  ON public.company_users FOR SELECT
  USING (
    user_id = auth.uid() OR -- Base case: users can always see their own role/membership
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
    )
  );

-- 2. Add Management Policies for Owners (super_admin)
DROP POLICY IF EXISTS "Owners can manage users" ON public.company_users;
CREATE POLICY "Owners can manage users"
  ON public.company_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'super_admin'
    )
  );

-- 3. Verify Transactions is_company_member check
-- (This check depends on company_users, so fixing the policy above also fixes this)
-- No changes needed to transactions if company_users is fixed.

-- 4. Notification View Policy Fix (Just in case)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
